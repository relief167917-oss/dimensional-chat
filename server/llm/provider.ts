export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  timeoutMs?: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatResult {
  text: string;
  usage: TokenUsage | null;
  provider: string;
  /** 整个逻辑调用的耗时，包含重试和退避。 */
  latencyMs: number;
}

export interface LLMProvider {
  readonly name: string;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult>;
}

export type LLMErrorCode =
  | 'MISSING_API_KEY'
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'SERVER_ERROR'
  | 'CLIENT_ERROR'
  | 'NETWORK_ERROR'
  | 'EMPTY_RESPONSE'
  | 'INVALID_RESPONSE'
  | 'NO_PROVIDER';

// 只接收本地定义的安全文案；不附带请求头、响应体或原始异常 cause。
export class LLMError extends Error {
  readonly name = 'LLMError';

  constructor(
    readonly code: LLMErrorCode,
    message: string,
    readonly retryable = false,
    readonly status?: number,
  ) {
    super(message);
  }
}
