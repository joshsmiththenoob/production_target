# Storge job id for every jobs including merging, comparing etc..
import uuid

from django.conf import settings
from django.db import models

# Create your models here.

# Jobs for different businesses logic
class Job(models.Model):

    # Define custom choices for specfic column
    class Kind(models.TextChoices):
        """
        Variety kinds of businesses
        """
        VOLUME_PRICE_MERGE = ("volume_price_merge", "量價/種植面積整併",)
        TABLE_COMPARE = ("table_compare", "表格比對",)

    class Status(models.TextChoices):
        """
        Status of job
        """
        PENDING = ("pending", "等待執行")
        RUNNING = ("running", "執行中")
        SUCCEEDED = ("succeeded", "執行成功")
        FAILED = ("failed", "執行失敗")
        EXPIRED = ("expired", "已過期")

    # id: for internal usage
    id = models.BigAutoField(primary_key= True)

    # public_id: uuid for public usage in API、URL、React
    public_id = models.UUIDField(default= uuid.uuid4, unique=True, editable= False)
    # Set custom choices to particular column
    kind = models.CharField(max_length= 30, choices= Kind, db_index= True)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, null= True, blank= True, on_delete=models.CASCADE, related_name="jobs",)
    # Set custom choice to particular column as defult choice
    status = models.CharField(max_length=20, choices=Status, default=Status.PENDING, db_index=True,)
    error_code = models.CharField(max_length=100, blank=True,)
    error_message = models.TextField(blank=True)

    expires_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)




# # Job results for variety of businesses including input/output file information for specifc bussiness
# it's like a abstract model for variety of bussinesses input/output model. To be continued when compare bussiness logic finished.
# class JobArtifact(models.Model):
#     class Purpose(models.TextChoices):
#         INPUT = ("input", "輸入")
#         OUTPUT = ("output", "輸出")

    
#     job = models.ForeignKey(Job ,on_delete=models.CASCADE,related_name="artifacts",)
#     # Set custom choice to particular column as defult choice
#     purpose = models.CharField(max_length=10, choices=Purpose,)

#     # production、area、docx、xlsx、result etc.
#     role = models.CharField(max_length=30)

#     original_name = models.CharField(max_length=255)
#     file = models.FileField(upload_to="jobs/%Y/%m/%d/")
#     size = models.PositiveBigIntegerField()

#     created_at = models.DateTimeField(auto_now_add=True)