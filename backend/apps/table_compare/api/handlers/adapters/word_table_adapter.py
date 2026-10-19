"""
The Excel Adapter is responsible for 
1. loading Excel files like .xlsx, .xls
2. then converting them into a common DataFrame format for comparison.
"""

from .base import DataAdapter
import pandas as pd
from docx import Document

class WordTableAdapter(DataAdapter):
    def __init__(self, path: str, table_index: int = 0):
        self.path = path
        self.table_index = table_index

    def load(self) -> pd.DataFrame:
        """Load the Word file and convert it to a Standardized DataFrame."""
        doc = Document(self.path)

        # We can check how many table the .doc/.docx has
        print(f"Document has {len(doc.tables)} tables.")


        # Parse the specific table
        table = doc.tables[self.table_index]

        # Exctract the table data into 2-D array by iterating row by row then cell by cell
        rows = [[cell.text.strip() for cell in row.cells] for row in table.rows]

        # Then get the headers from the first row and the data from the rest of rows
        headers = rows[0]
        data = rows[1:]
    
        return self.__convert_to_dataframe(headers, data)
    
    def __convert_to_dataframe(self, headers, data) -> pd.DataFrame:
        return pd.DataFrame(data, columns=headers)