import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { chatApi } from '@/lib/api-client';

jest.mock('@/lib/api-client', () => ({
  chatApi: {
    getMessages: jest.fn(),
    streamQuery: jest.fn(),
    deleteConversation: jest.fn(),
    conversations: jest.fn(),
  },
  getAccessToken: jest.fn(),
  setAccessToken: jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

const mockChatApi = chatApi as jest.Mocked<typeof chatApi>;

describe('ChatInterface', () => {
  const mockMessages = [
    {
      id: '1',
      conversation_id: 'session-1',
      role: 'user' as const,
      content: 'Hello',
      sources: null,
      confidence_score: null,
      model_used: null,
      latency_ms: null,
      created_at: new Date().toISOString(),
    },
    {
      id: '2',
      conversation_id: 'session-1',
      role: 'assistant' as const,
      content: 'Hi there!',
      sources: [],
      confidence_score: 0.8,
      model_used: 'gemini-2.0-flash',
      latency_ms: 120,
      created_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockChatApi.getMessages.mockResolvedValue(mockMessages);
  });

  it('renders chat messages loaded from an existing session', async () => {
    render(<ChatInterface sessionId="session-1" />);

    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(screen.getByText('Hi there!')).toBeInTheDocument();
    });
  });

  it('shows user and assistant messages with different data-role styling', async () => {
    render(<ChatInterface sessionId="session-1" />);

    await waitFor(() => {
      const userMessage = screen.getByText('Hello').closest('[data-role="user"]');
      const assistantMessage = screen.getByText('Hi there!').closest('[data-role="assistant"]');
      expect(userMessage).toBeInTheDocument();
      expect(assistantMessage).toBeInTheDocument();
    });
  });

  it('streams deltas into the assistant message as they arrive', async () => {
    mockChatApi.getMessages.mockResolvedValue([]);
    mockChatApi.streamQuery.mockImplementation(async (_msg, _sessionId, callbacks) => {
      callbacks.onDelta?.('Hello');
      callbacks.onDelta?.(' world');
      callbacks.onDone?.({
        id: 'msg-3',
        conversation_id: 'session-1',
        sources: [],
        confidence_score: 0.9,
        model_used: 'gemini-2.0-flash',
        created_at: new Date().toISOString(),
      });
    });

    render(<ChatInterface sessionId="session-1" />);

    const input = screen.getByPlaceholderText(/type a message/i);
    fireEvent.change(input, { target: { value: 'New question' } });
    fireEvent.submit(screen.getByRole('form'));

    await waitFor(() => {
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });
  });

  it('disables send while a message is in flight and re-enables after', async () => {
    mockChatApi.getMessages.mockResolvedValue([]);
    let resolveStream!: () => void;
    mockChatApi.streamQuery.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveStream = resolve;
        })
    );

    render(<ChatInterface sessionId="session-1" />);

    const input = screen.getByPlaceholderText(/type a message/i);
    fireEvent.change(input, { target: { value: 'Test' } });
    fireEvent.submit(screen.getByRole('form'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled();
    });

    resolveStream();

    await waitFor(() => {
      expect(input).not.toBeDisabled();
    });
  });

  it('displays citations for assistant messages once streaming completes', async () => {
    mockChatApi.getMessages.mockResolvedValue([]);
    mockChatApi.streamQuery.mockImplementation(async (_msg, _sessionId, callbacks) => {
      callbacks.onDelta?.('Answer with citation');
      callbacks.onDone?.({
        id: 'msg-4',
        conversation_id: 'session-1',
        sources: [
          {
            document_id: 'doc-1',
            document_name: 'handbook.pdf',
            chunk_index: 0,
            content: 'Relevant text',
            score: 0.9,
          },
        ],
        confidence_score: 0.9,
        model_used: 'gemini-2.0-flash',
        created_at: new Date().toISOString(),
      });
    });

    render(<ChatInterface sessionId="session-1" />);

    fireEvent.change(screen.getByPlaceholderText(/type a message/i), {
      target: { value: 'Cite something' },
    });
    fireEvent.submit(screen.getByRole('form'));

    await waitFor(() => {
      expect(screen.getByLabelText('citations')).toBeInTheDocument();
      expect(screen.getByText('Relevant text')).toBeInTheDocument();
    });
  });

  it('shows an error toast and inline message when streaming fails', async () => {
    const { toast } = jest.requireMock('sonner');
    mockChatApi.getMessages.mockResolvedValue([]);
    mockChatApi.streamQuery.mockImplementation(async (_msg, _sessionId, callbacks) => {
      callbacks.onError?.('Network error');
    });

    render(<ChatInterface sessionId="session-1" />);

    fireEvent.change(screen.getByPlaceholderText(/type a message/i), {
      target: { value: 'Test' },
    });
    fireEvent.submit(screen.getByRole('form'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Network error'));
    });
  });

  it('notifies the parent of a newly created conversation id', async () => {
    mockChatApi.getMessages.mockResolvedValue([]);
    mockChatApi.streamQuery.mockImplementation(async (_msg, _sessionId, callbacks) => {
      callbacks.onDone?.({
        id: 'msg-5',
        conversation_id: 'new-conversation-id',
        sources: [],
        confidence_score: 1.0,
        model_used: 'gemini-2.0-flash',
        created_at: new Date().toISOString(),
      });
    });
    const onConversationCreated = jest.fn();

    render(<ChatInterface sessionId={null} onConversationCreated={onConversationCreated} />);

    fireEvent.change(screen.getByPlaceholderText(/type a message/i), {
      target: { value: 'Start fresh' },
    });
    fireEvent.submit(screen.getByRole('form'));

    await waitFor(() => {
      expect(onConversationCreated).toHaveBeenCalledWith('new-conversation-id');
    });
  });
});
