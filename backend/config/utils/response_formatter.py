from typing import Any
from rest_framework.response import Response



class ResponseFormatter:
    # @staticmethod
    # the parameter after '*' must be specified parameter name of argument instead of using positional argument directly while another program call it. 
    # Ex: success_response(response_data, message = response_message, meta = response_meta)
    @staticmethod
    def success_response(
        data: Any = None,
        *,
        http_status: int,
        message: str | None = None,
        meta: dict[str, Any] | None = None,
    ) -> Response:
        """
        Format the response in a standard specification:

        Args:
            data (any, optional): Additional data to include in the response.
            message (str): A message describing the result.
            meta: a description of response like 'status' etc.
        
        Return:
            dict: A dictionary of formatted sucessful response    

        """
        response_data: dict[str, Any] = {
            "data": data,
            "message": message,
            "meta": meta,
            }

        return Response(response_data, status= http_status)

    # @staticmethod
    # def success_response(*, data: Any = None, http_status: status, message: str = None, meta: dict[str, Any] = None):
    #     payload = ResponseFormatter._wrap_sucess_success_response(data, message= message, meta= meta)

    #     return Response(payload, status= http_status)

    @staticmethod
    def error_response(
        code: str,
        *,
        http_status: int,
        message: str,
        field_errors: dict[str, Any] | None = None,
    ) -> Response:
        response_data: dict[str, Any] = {
            "code": code,
            "message": message,
            "field_errors": field_errors or {},
        }

        return Response(response_data, status= http_status)


    # @staticmethod
    # def error_response(*, code: str, message: str, http_status: status, field_errors: dict[str, Any] = None):
    #     payload = ResponseFormatter._wrap_error_response(code, message, field_errors= field_errors)

    #     return Response(payload, status= http_status)
