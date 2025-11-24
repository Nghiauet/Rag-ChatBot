import type { OpenAPIV3 } from 'openapi-types';

export const openApiSpec: OpenAPIV3.Document = {
  openapi: '3.0.0',
  info: {
    title: 'RAG ChatBot API',
    version: '1.0.0',
    description: 'API documentation for the RAG ChatBot application with document and URL management capabilities',
    contact: {
      name: 'API Support',
    },
  },
  servers: [
    {
      url: '/api',
      description: 'API Server',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token from /auth/login endpoint',
      },
    },
    schemas: {
      // Auth Schemas
      LoginRequest: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: {
            type: 'string',
            minLength: 1,
            description: 'Username for authentication',
          },
          password: {
            type: 'string',
            minLength: 1,
            description: 'Password for authentication',
          },
          role: {
            type: 'string',
            description: 'Optional role parameter',
          },
        },
      },
      LoginResponse: {
        type: 'object',
        properties: {
          access_token: { type: 'string', description: 'JWT access token' },
          refresh_token: { type: 'string', description: 'JWT refresh token' },
          id: { type: 'string', description: 'User ID' },
          username: { type: 'string', description: 'Username' },
          role: { type: 'string', description: 'User role' },
          hospitalGroupId: { type: 'string', nullable: true },
          status: { type: 'string', description: 'User status' },
          type: { type: 'string', description: 'User type' },
          avatar: { type: 'string', nullable: true },
          fullName: { type: 'string', description: 'Full name of the user' },
        },
      },

      // Query Schemas
      QueryRequest: {
        type: 'object',
        required: ['question'],
        properties: {
          question: {
            type: 'string',
            minLength: 1,
            description: 'The question to ask the RAG system',
          },
          session_id: {
            type: 'string',
            description: 'Optional session ID to maintain conversation context',
          },
        },
      },
      Citation: {
        type: 'object',
        properties: {
          filename: { type: 'string', description: 'Source document filename' },
          pages: {
            type: 'array',
            items: { type: 'number' },
            description: 'Page numbers where the information was found',
          },
          relevance_score: { type: 'number', description: 'Relevance score (optional)' },
          excerpt: { type: 'string', description: 'Text excerpt (optional)' },
        },
      },
      QueryResponse: {
        type: 'object',
        properties: {
          answer: { type: 'string', description: 'The AI-generated answer' },
          session_id: { type: 'string', description: 'Session ID for this conversation' },
          sources: {
            type: 'object',
            additionalProperties: {
              type: 'array',
              items: { type: 'number' },
            },
            description: 'Deprecated: Map of filename to page numbers',
          },
          citations: {
            type: 'array',
            items: { $ref: '#/components/schemas/Citation' },
            description: 'Enhanced citation information',
          },
        },
      },

      // Chat History Schemas
      ChatMessage: {
        type: 'object',
        properties: {
          role: {
            type: 'string',
            enum: ['human', 'ai'],
            description: 'Message role',
          },
          content: { type: 'string', description: 'Message content' },
        },
      },
      ChatHistoryResponse: {
        type: 'object',
        properties: {
          session_id: { type: 'string', description: 'Session ID' },
          history: {
            type: 'array',
            items: { $ref: '#/components/schemas/ChatMessage' },
            description: 'Chat history messages',
          },
        },
      },

      // Document Schemas
      DocumentInfo: {
        type: 'object',
        properties: {
          filename: { type: 'string', description: 'Document filename' },
          size: { type: 'number', description: 'File size in bytes' },
          upload_date: { type: 'string', description: 'Upload timestamp' },
        },
      },
      DocumentListResponse: {
        type: 'object',
        properties: {
          documents: {
            type: 'array',
            items: { $ref: '#/components/schemas/DocumentInfo' },
            description: 'List of documents',
          },
        },
      },
      UploadResponse: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Success message' },
          filename: { type: 'string', description: 'Uploaded filename' },
        },
      },

      // URL Document Schemas
      UrlDocument: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Unique URL document ID' },
          url: { type: 'string', format: 'uri', description: 'The URL' },
          title: { type: 'string', description: 'Document title' },
          status: {
            type: 'string',
            enum: ['pending', 'fetched', 'indexed', 'error'],
            description: 'Processing status',
          },
          contentType: {
            type: 'string',
            enum: ['html', 'pdf'],
            description: 'Content type',
          },
          dateAdded: { type: 'string', description: 'Date added' },
          lastFetched: { type: 'string', description: 'Last fetch timestamp' },
          lastIndexed: { type: 'string', description: 'Last index timestamp' },
          error: { type: 'string', description: 'Error message if any' },
        },
      },
      UrlListResponse: {
        type: 'object',
        properties: {
          urls: {
            type: 'array',
            items: { $ref: '#/components/schemas/UrlDocument' },
            description: 'List of URL documents',
          },
        },
      },
      AddUrlRequest: {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string', format: 'uri', description: 'URL to add' },
        },
      },
      AddUrlResponse: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Success message' },
          url: { $ref: '#/components/schemas/UrlDocument' },
        },
      },
      AddBulkUrlsRequest: {
        type: 'object',
        required: ['urls'],
        properties: {
          urls: {
            type: 'array',
            items: { type: 'string', format: 'uri' },
            description: 'Array of URLs to add',
          },
        },
      },
      BulkUrlResult: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL' },
          status: { type: 'string', enum: ['success', 'error'] },
          message: { type: 'string', description: 'Result message' },
          document: { $ref: '#/components/schemas/UrlDocument' },
        },
      },
      AddBulkUrlsResponse: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Summary message' },
          total: { type: 'number', description: 'Total URLs processed' },
          successful: { type: 'number', description: 'Number of successful additions' },
          failed: { type: 'number', description: 'Number of failed additions' },
          results: {
            type: 'array',
            items: { $ref: '#/components/schemas/BulkUrlResult' },
          },
        },
      },
      RefreshUrlResponse: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Success message' },
          url: { $ref: '#/components/schemas/UrlDocument' },
        },
      },

      // Prompt Configuration Schemas
      PromptConfig: {
        type: 'object',
        properties: {
          system_prompt: { type: 'string', description: 'System prompt for the AI' },
          user_greeting: { type: 'string', description: 'User greeting message' },
          context_instruction: { type: 'string', description: 'Context instruction' },
          fallback_response: { type: 'string', description: 'Fallback response' },
        },
      },
      PromptUpdateRequest: {
        type: 'object',
        required: ['prompts'],
        properties: {
          prompts: { $ref: '#/components/schemas/PromptConfig' },
        },
      },

      // System Schemas
      InitResponse: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Initialization message' },
          status: { type: 'string', description: 'Initialization status' },
        },
      },
      HealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Health status' },
          timestamp: { type: 'string', description: 'Current timestamp' },
        },
      },
      RebuildEmbeddingsResponse: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Rebuild status message' },
          status: { type: 'string', description: 'Current rebuild status' },
          progress: { type: 'number', description: 'Progress percentage (0-100)' },
        },
      },

      // Error Response
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string', description: 'Error message' },
          details: { type: 'string', description: 'Additional error details' },
        },
      },
    },
  },
  paths: {
    // Authentication
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'User login',
        description: 'Authenticate user and receive JWT tokens',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
              example: {
                username: 'user@example.com',
                password: 'password123',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginResponse' },
              },
            },
          },
          '401': {
            description: 'Invalid credentials',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },

    // Query / Chat
    '/query': {
      post: {
        tags: ['Chat & RAG'],
        summary: 'Ask a question',
        description: 'Submit a question to the RAG system and receive an AI-generated answer with citations',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/QueryRequest' },
              example: {
                question: 'What are the key features of the product?',
                session_id: 'optional-session-id',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Answer generated successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/QueryResponse' },
              },
            },
          },
          '400': {
            description: 'Invalid request',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '500': {
            description: 'Server error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },

    // Chat History
    '/history/{sessionId}': {
      get: {
        tags: ['Chat & RAG'],
        summary: 'Get chat history',
        description: 'Retrieve chat history for a specific session',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'sessionId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Session ID',
          },
        ],
        responses: {
          '200': {
            description: 'Chat history retrieved',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ChatHistoryResponse' },
              },
            },
          },
          '404': {
            description: 'Session not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      delete: {
        tags: ['Chat & RAG'],
        summary: 'Clear chat history',
        description: 'Delete chat history for a specific session',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'sessionId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Session ID',
          },
        ],
        responses: {
          '200': {
            description: 'History cleared successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },

    // Document Management
    '/documents': {
      get: {
        tags: ['Document Management'],
        summary: 'List documents',
        description: 'Retrieve list of all uploaded PDF documents',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Documents retrieved successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DocumentListResponse' },
              },
            },
          },
        },
      },
    },
    '/documents/upload': {
      post: {
        tags: ['Document Management'],
        summary: 'Upload document',
        description: 'Upload a PDF document for indexing',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: 'PDF file to upload',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Document uploaded successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UploadResponse' },
              },
            },
          },
          '400': {
            description: 'Invalid file or request',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/documents/{filename}': {
      delete: {
        tags: ['Document Management'],
        summary: 'Delete document',
        description: 'Delete a document by filename',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'filename',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Document filename',
          },
        ],
        responses: {
          '200': {
            description: 'Document deleted successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Document not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/documents/{filename}/download': {
      get: {
        tags: ['Document Management'],
        summary: 'Download document',
        description: 'Download a document by filename',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'filename',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Document filename',
          },
        ],
        responses: {
          '200': {
            description: 'Document file',
            content: {
              'application/pdf': {
                schema: {
                  type: 'string',
                  format: 'binary',
                },
              },
            },
          },
          '404': {
            description: 'Document not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/documents/rebuild-embeddings': {
      post: {
        tags: ['Document Management'],
        summary: 'Rebuild embeddings',
        description: 'Rebuild vector database embeddings for all documents',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Rebuild started',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RebuildEmbeddingsResponse' },
              },
            },
          },
        },
      },
      get: {
        tags: ['Document Management'],
        summary: 'Get rebuild status',
        description: 'Check the status of embeddings rebuild process',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Rebuild status',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RebuildEmbeddingsResponse' },
              },
            },
          },
        },
      },
    },

    // URL Management
    '/urls': {
      get: {
        tags: ['URL Management'],
        summary: 'List URLs',
        description: 'Retrieve list of all indexed URLs',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'URLs retrieved successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UrlListResponse' },
              },
            },
          },
        },
      },
      post: {
        tags: ['URL Management'],
        summary: 'Add URL(s)',
        description: 'Add one or multiple URLs to fetch and index. Supports both single URL and bulk operations.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  { $ref: '#/components/schemas/AddUrlRequest' },
                  { $ref: '#/components/schemas/AddBulkUrlsRequest' },
                ],
              },
              examples: {
                singleUrl: {
                  summary: 'Add single URL',
                  value: {
                    url: 'https://example.com/document',
                  },
                },
                bulkUrls: {
                  summary: 'Add multiple URLs',
                  value: {
                    urls: [
                      'https://example.com/doc1',
                      'https://example.com/doc2',
                    ],
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'URL(s) added successfully',
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    { $ref: '#/components/schemas/AddUrlResponse' },
                    { $ref: '#/components/schemas/AddBulkUrlsResponse' },
                  ],
                },
              },
            },
          },
          '400': {
            description: 'Invalid URL or request',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/urls/{id}': {
      get: {
        tags: ['URL Management'],
        summary: 'Get URL details',
        description: 'Retrieve details for a specific URL document',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'URL document ID',
          },
        ],
        responses: {
          '200': {
            description: 'URL details retrieved',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UrlDocument' },
              },
            },
          },
          '404': {
            description: 'URL not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      delete: {
        tags: ['URL Management'],
        summary: 'Delete URL',
        description: 'Delete a URL document by ID',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'URL document ID',
          },
        ],
        responses: {
          '200': {
            description: 'URL deleted successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
          '404': {
            description: 'URL not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/urls/{id}/refresh': {
      post: {
        tags: ['URL Management'],
        summary: 'Refresh URL content',
        description: 'Re-fetch and re-index content from a URL',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'URL document ID',
          },
        ],
        responses: {
          '200': {
            description: 'URL refreshed successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RefreshUrlResponse' },
              },
            },
          },
          '404': {
            description: 'URL not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/urls/{id}/status': {
      get: {
        tags: ['URL Management'],
        summary: 'Get URL status',
        description: 'Get processing status of a URL document',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'URL document ID',
          },
        ],
        responses: {
          '200': {
            description: 'URL status retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    status: {
                      type: 'string',
                      enum: ['pending', 'fetched', 'indexed', 'error'],
                    },
                    error: { type: 'string' },
                  },
                },
              },
            },
          },
          '404': {
            description: 'URL not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },

    // Prompt Configuration
    '/prompts': {
      get: {
        tags: ['Configuration'],
        summary: 'Get prompt configuration',
        description: 'Retrieve current prompt configuration',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Prompt configuration retrieved',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PromptConfig' },
              },
            },
          },
        },
      },
      put: {
        tags: ['Configuration'],
        summary: 'Update prompt configuration',
        description: 'Update prompt configuration settings',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PromptUpdateRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Prompts updated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    prompts: { $ref: '#/components/schemas/PromptConfig' },
                  },
                },
              },
            },
          },
        },
      },
    },

    // System
    '/init': {
      post: {
        tags: ['System'],
        summary: 'Initialize vector database',
        description: 'Initialize the vector database',
        responses: {
          '200': {
            description: 'Database initialized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/InitResponse' },
              },
            },
          },
        },
      },
      get: {
        tags: ['System'],
        summary: 'Check initialization status',
        description: 'Check if the vector database is initialized',
        responses: {
          '200': {
            description: 'Initialization status',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/InitResponse' },
              },
            },
          },
        },
      },
    },
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        description: 'Check API health status',
        responses: {
          '200': {
            description: 'API is healthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
        },
      },
    },
  },
  tags: [
    { name: 'Authentication', description: 'User authentication endpoints' },
    { name: 'Chat & RAG', description: 'Chat and RAG query endpoints' },
    { name: 'Document Management', description: 'PDF document management' },
    { name: 'URL Management', description: 'URL document management' },
    { name: 'Configuration', description: 'System configuration' },
    { name: 'System', description: 'System health and initialization' },
  ],
};
