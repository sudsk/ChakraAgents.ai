// frontend/src/components/DocumentUploader.jsx
import React, { useState } from 'react';
import { 
  Box, Button, FormControl, FormLabel, Input, 
  Progress, Text, useToast 
} from '@chakra-ui/react';
import { FiUpload } from 'react-icons/fi';

const DocumentUploader = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const toast = useToast();
  
  const handleUpload = async () => {
    if (!file) return;
    
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const data = await response.json();
      
      toast({
        title: 'Upload successful',
        description: data.message,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      setFile(null);
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };
  
  return (
    <Box p={4} borderWidth="1px" borderRadius="lg">
      <FormControl>
        <FormLabel>Upload Document to Knowledge Base</FormLabel>
        <Input
          type="file"
          onChange={(e) => setFile(e.target.files[0])}
          accept=".pdf,.txt,.csv,.md"
          p={1}
        />
      </FormControl>
      
      {uploading && (
        <Progress value={progress} mt={4} colorScheme="blue" />
      )}
      
      <Button
        mt={4}
        colorScheme="blue"
        leftIcon={<FiUpload />}
        onClick={handleUpload}
        isLoading={uploading}
        isDisabled={!file}
      >
        Upload
      </Button>
    </Box>
  );
};

export default DocumentUploader;
