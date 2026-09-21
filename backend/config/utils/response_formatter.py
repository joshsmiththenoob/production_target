from typing import Any

class ResponseFormatter:
    @staticmethod
    # the parameter after '*' must be specified parameter name of argument instead of using positional argument directly while another program call it. 
    # Ex: success_response(response_data, message = response_message, meta = response_meta)
    def success_response(data: Any = None, *, message: str = None, meta: dict[str, Any] = None) -> dict[str, Any]:
        """
        Format the response in a standard specification:

        Args:
            data (any, optional): Additional data to include in the response.
            message (str): A message describing the result.
            meta: a description of response like 'status' etc.
        
        Return:
            dict: A dictionary of formatted sucessful response    

        """
        response_data: dict[str, Any] = {"data": data}


        if (message is not None):
            response_data["message"] = message


        if (meta is not None):
            response_data["meta"] = meta


        return response_data


    @staticmethod
    def error_response(code: str, message: str, *, field_errors: dict[str, Any] = None):
        response_data: dict[str, Any] = {
            "code": code,
            "message": message,
            "field_errors": field_errors
        }

        return response_data