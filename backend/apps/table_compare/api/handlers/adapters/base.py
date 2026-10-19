# Basic Abstract class for Adpaters
from abc import ABC, abstractmethod
import pandas as pd
from pathlib import Path

class DataAdapter(ABC):
    @abstractmethod
    def load(self) -> pd.DataFrame:
        """Return a normalized DataFrame with unified columns."""
        if self.path is None:
            raise NotImplementedError('Class attribute PATH not advised at DataAdapter inheritance')
    def __convert_to_dataframe(self)-> pd.DataFrame:
        """Convert the raw dataset into a Common DataFrame format. Must be implemented by subclasses."""
        raise NotImplementedError("Subclasses must implement this method.")