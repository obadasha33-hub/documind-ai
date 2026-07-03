import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocumentUpload } from '@/components/documents/DocumentUpload';
import { documentsApi } from '@/lib/api-client';

jest.mock('@/lib/api-client', () => ({
  documentsApi: {
    upload: jest.fn(),
  },
}));

const mockDocumentsApi = documentsApi as jest.Mocked<typeof documentsApi>;

describe('DocumentUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders upload area', () => {
    render(<DocumentUpload onUploadComplete={jest.fn()} />);
    expect(screen.getByText(/drag and drop/i)).toBeInTheDocument();
    expect(screen.getByText(/or click to browse/i)).toBeInTheDocument();
  });

  it('handles file selection', async () => {
    const onUploadComplete = jest.fn();
    mockDocumentsApi.upload.mockResolvedValue({
      id: '1',
      tenant_id: 't1',
      filename: 'test.pdf',
      file_type: 'pdf',
      file_size: 100,
      status: 'processing',
      chunk_count: 0,
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    render(<DocumentUpload onUploadComplete={onUploadComplete} />);

    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/file input/i);
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockDocumentsApi.upload).toHaveBeenCalledWith(file);
    });

    expect(onUploadComplete).toHaveBeenCalledWith(expect.objectContaining({ filename: 'test.pdf' }));
  });

  it('rejects unsupported file types', async () => {
    render(<DocumentUpload onUploadComplete={jest.fn()} />);

    const file = new File(['test'], 'test.xyz', { type: 'application/xyz' });
    const input = screen.getByLabelText(/file input/i);
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/unsupported file type/i)).toBeInTheDocument();
    });
    expect(mockDocumentsApi.upload).not.toHaveBeenCalled();
  });

  it('rejects files that are too large', async () => {
    render(<DocumentUpload onUploadComplete={jest.fn()} />);

    const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/file input/i);
    fireEvent.change(input, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(screen.getByText(/file too large/i)).toBeInTheDocument();
    });
    expect(mockDocumentsApi.upload).not.toHaveBeenCalled();
  });

  it('shows upload progress', async () => {
    const onUploadComplete = jest.fn();
    mockDocumentsApi.upload.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                id: '1',
                tenant_id: 't1',
                filename: 'test.pdf',
                file_type: 'pdf',
                file_size: 100,
                status: 'processing',
                chunk_count: 0,
                error_message: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }),
            100
          )
        )
    );

    render(<DocumentUpload onUploadComplete={onUploadComplete} />);

    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/file input/i);
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/uploading/i)).toBeInTheDocument();
    });
  });

  it('handles upload error', async () => {
    const onUploadComplete = jest.fn();
    mockDocumentsApi.upload.mockRejectedValue(new Error('Upload failed'));

    render(<DocumentUpload onUploadComplete={onUploadComplete} />);

    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/file input/i);
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/upload failed/i)).toBeInTheDocument();
    });
  });
});
