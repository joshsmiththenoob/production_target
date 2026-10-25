from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from uuid import UUID

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from drf_spectacular.generators import SchemaGenerator
from openpyxl import Workbook
from rest_framework.test import APITestCase

from apps.jobs.models import Job
from apps.table_compare.models import CompareInputFile, TableCompareJob
from apps.table_compare.api.handlers.adapters.excel_table_adapter import ExcelTableAdapter


def excel_bytes():
    workbook = Workbook()
    for row in [
        ['Anonymous fixture'], ['', '111年', '111年'],
        ['', '果品', '特作'], ['', '香蕉', '茶'],
        ['果品產量(公噸)', 12, ''], ['特作產量(公噸)', '', 34],
    ]:
        workbook.active.append(row)
    output = BytesIO()
    workbook.save(output)
    workbook.close()
    return output.getvalue()


def pdf_bytes():
    # Anonymous, real text PDF. This page intentionally has no supported table.
    stream = b'BT /F1 12 Tf 40 100 Td (Anonymous unsupported page) Tj ET'
    objects = [
        b'<< /Type /Catalog /Pages 2 0 R >>',
        b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        b'<< /Length ' + str(len(stream)).encode() + b' >>\nstream\n' + stream + b'\nendstream',
    ]
    result = b'%PDF-1.4\n'
    offsets = []
    for index, obj in enumerate(objects, 1):
        offsets.append(len(result))
        result += str(index).encode() + b' 0 obj\n' + obj + b'\nendobj\n'
    start = len(result)
    result += b'xref\n0 6\n0000000000 65535 f \n'
    result += b''.join(f'{offset:010d} 00000 n \n'.encode() for offset in offsets)
    return result + b'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + str(start).encode() + b'\n%%EOF\n'


class ComparingPreviewApiTests(APITestCase):
    def setUp(self):
        media = TemporaryDirectory()
        self.addCleanup(media.cleanup)
        self.media_root = Path(media.name)
        settings = override_settings(MEDIA_ROOT=media.name)
        settings.enable()
        self.addCleanup(settings.disable)
        self.url = reverse('table_compare:comparison-preview')

    def uploads(self):
        return {
            'excel_file': SimpleUploadedFile('anonymous.xlsx', excel_bytes()),
            'pdf_file': SimpleUploadedFile('anonymous.pdf', pdf_bytes()),
        }

    def assert_no_artifacts(self):
        for model in (Job, TableCompareJob, CompareInputFile):
            self.assertEqual(model.objects.count(), 0)
        self.assertEqual([p for p in self.media_root.rglob('*') if p.is_file()], [])

    def test_real_upload_persists_preview_and_exact_bytes(self):
        uploads = self.uploads()
        expected = {key.removesuffix('_file'): value.read() for key, value in uploads.items()}
        for file in uploads.values():
            file.seek(0)
        frame = ExcelTableAdapter(uploads['excel_file']).load()
        self.assertEqual(list(zip(frame['作物'], frame['數值'])), [('香蕉', 12), ('茶', 34)])
        uploads['excel_file'].seek(0)
        response = self.client.post(self.url, uploads, format='multipart')
        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(set(payload), {'data', 'message', 'meta'})
        self.assertEqual(set(payload['data']), {'public_id', 'preview'})
        public_id = UUID(payload['data']['public_id'])
        self.assertEqual(Job.objects.count(), 1)
        job = Job.objects.get(public_id=public_id)
        self.assertEqual(job.status, Job.Status.PENDING)
        self.assertEqual(job.kind, Job.Kind.TABLE_COMPARE)
        self.assertEqual(TableCompareJob.objects.count(), 1)
        preview = payload['data']['preview']
        self.assertEqual(job.table_compare.preview, preview)
        self.assertIsNone(job.table_compare.result_data)
        self.assertEqual(set(preview), {'crops', 'years', 'metrics', 'defaults', 'issues'})
        self.assertEqual(preview['crops'], ['香蕉', '茶'])
        self.assertEqual(preview['defaults']['crops'], preview['crops'])
        self.assertEqual(preview['years'], [])
        self.assertEqual(preview['defaults']['years'], [])
        self.assertTrue(any('第 1 頁未解析' in issue for issue in preview['issues']))
        self.assertEqual(CompareInputFile.objects.count(), 2)
        self.assertEqual(set(job.table_compare.input_files.values_list('file_type', flat=True)), {'excel', 'pdf'})
        for source in job.table_compare.input_files.all():
            self.assertTrue(source.file.storage.exists(source.file.name))
            with source.file.open('rb') as stored:
                self.assertEqual(stored.read(), expected[source.file_type])
            self.assertEqual(source.size_bytes, len(expected[source.file_type]))

    def test_invalid_uploads_leave_no_jobs_or_files(self):
        for field in ('excel_file', 'pdf_file'):
            for failure in ('missing', 'extension', 'corrupt'):
                with self.subTest(field=field, failure=failure):
                    uploads = self.uploads()
                    if failure == 'missing':
                        del uploads[field]
                    elif failure == 'extension':
                        uploads[field].name = 'wrong.txt'
                    else:
                        uploads[field] = SimpleUploadedFile(uploads[field].name, b'corrupt data')
                    response = self.client.post(self.url, uploads, format='multipart')
                    self.assertEqual(response.status_code, 400)
                    self.assertEqual(response.json()['code'], 'invalid_preview' if failure == 'corrupt' else 'invalid_upload')
                    self.assert_no_artifacts()

    def test_storage_failure_cleans_saved_file_and_rolls_back(self):
        storage = CompareInputFile._meta.get_field('file').storage
        original_save = storage.save
        calls = 0

        def fail_second(*args, **kwargs):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise OSError('storage unavailable')
            return original_save(*args, **kwargs)

        with patch.object(storage, 'save', side_effect=fail_second):
            with self.assertRaisesMessage(OSError, 'storage unavailable'):
                self.client.post(self.url, self.uploads(), format='multipart')
        self.assert_no_artifacts()

    def test_schema_describes_binary_upload_and_created_job(self):
        schema = SchemaGenerator().get_schema(request=None, public=True)

        def resolve(value):
            while '$ref' in value:
                value = schema['components']['schemas'][value['$ref'].split('/')[-1]]
            return value

        operation = schema['paths']['/api/v1/table-compare/jobs/']['post']
        request = resolve(operation['requestBody']['content']['multipart/form-data']['schema'])
        self.assertEqual(set(request['required']), {'excel_file', 'pdf_file'})
        for field in ('excel_file', 'pdf_file'):
            self.assertEqual(request['properties'][field], {'type': 'string', 'format': 'binary'})
        self.assertIn('201', operation['responses'])
        self.assertNotIn('200', operation['responses'])
        response = resolve(operation['responses']['201']['content']['application/json']['schema'])
        self.assertEqual(set(response['properties']), {'data', 'message', 'meta'})
        data = resolve(response['properties']['data'])
        self.assertEqual(data['properties']['public_id']['format'], 'uuid')
        preview = resolve(data['properties']['preview'])
        self.assertEqual(set(preview['properties']), {'crops', 'years', 'metrics', 'defaults', 'issues'})

    def test_database_failure_after_storage_save_cleans_file(self):
        with patch.object(CompareInputFile, 'save', side_effect=RuntimeError('insert failed')):
            with self.assertRaisesMessage(RuntimeError, 'insert failed'):
                self.client.post(self.url, self.uploads(), format='multipart')
        self.assert_no_artifacts()
