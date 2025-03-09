# backend/app/services/document_service.py
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import TextLoader, PDFLoader, CSVLoader

class DocumentProcessor:
    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200
        )
    
    def load_and_split(self, file_path):
        """Load document and split into chunks"""
        if file_path.endswith('.pdf'):
            loader = PDFLoader(file_path)
        elif file_path.endswith('.csv'):
            loader = CSVLoader(file_path)
        else:
            loader = TextLoader(file_path)
        
        documents = loader.load()
        return self.text_splitter.split_documents(documents)
