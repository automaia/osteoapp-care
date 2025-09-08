import React, { useRef, useState } from 'react';
import { Upload, X, FileText, Image as ImageIcon } from 'lucide-react';
import { validateFile, compressImageIfNeeded } from '../../utils/fileUpload';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onError: (error: string) => void;
  accept?: string;
  currentFile?: {
    url: string;
    name: string;
    type: string;
  };
  className?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  onError,
  accept = "image/*,application/pdf,.doc,.docx",
  currentFile,
  className = "",
}) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      await validateFile(file);
      const processedFile = await compressImageIfNeeded(file);

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreview(reader.result as string);
        };
        reader.readAsDataURL(processedFile);
      } else {
        setPreview(null);
      }

      onFileSelect(processedFile);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Erreur lors du traitement du fichier');
    } finally {
      setIsLoading(false);
    }
  };

  const clearFile = () => {
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <ImageIcon size={24} />;
    }
    return <FileText size={24} />;
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div
        className={`relative border-2 border-dashed rounded-lg p-4 text-center ${
          isLoading
            ? 'bg-gray-50 border-gray-300'
            : 'bg-white border-gray-300 hover:bg-gray-50 hover:border-primary-500'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept={accept}
          disabled={isLoading}
        />

        {isLoading ? (
          <div className="py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500">Traitement en cours...</p>
          </div>
        ) : preview ? (
          <div className="relative">
            <img
              src={preview}
              alt="Preview"
              className="max-h-48 mx-auto rounded"
            />
            <button
              type="button"
              onClick={clearFile}
              className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md hover:bg-gray-100"
            >
              <X size={16} />
            </button>
          </div>
        ) : currentFile ? (
          <div className="py-4">
            <div className="flex items-center justify-center space-x-2 text-gray-600">
              {getFileIcon(currentFile.type)}
              <span className="text-sm">{currentFile.name}</span>
            </div>
            <button
              type="button"
              onClick={clearFile}
              className="mt-2 text-sm text-primary-600 hover:text-primary-700"
            >
              Changer le fichier
            </button>
          </div>
        ) : (
          <div
            className="py-8 cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-500">
              Cliquez ou glissez un fichier ici
            </p>
            <p className="text-xs text-gray-400 mt-1">
              PDF, DOC, DOCX, JPG ou PNG jusqu'à 10MB
            </p>
          </div>
        )}
      </div>
    </div>
  );
};