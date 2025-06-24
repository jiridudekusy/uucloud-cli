const Gantt = require('../src/misc/gantt');
const { Uri } = require("uu_appg01_core-uri");

describe('Gantt', () => {
    let mockConsole;
    let mockUuAppLogStoreClient;
    let mockOidcTokenProvider;
    let mockUuAppLogStoreClientFactory;
    let mockOidcTokenProviderFactory;
    let gantt;

    beforeEach(() => {
        // Mock console
        mockConsole = {
            log: jest.fn(),
            error: jest.fn(),
            info: jest.fn(),
            warn: jest.fn()
        };

        // Mock UuAppLogStoreClient
        mockUuAppLogStoreClient = {
            getAuditLogs: jest.fn()
        };

        // Mock OidcTokenProvider
        mockOidcTokenProvider = {
            getToken: jest.fn()
        };

        // Mock factories
        mockUuAppLogStoreClientFactory = jest.fn().mockReturnValue(mockUuAppLogStoreClient);
        mockOidcTokenProviderFactory = jest.fn().mockReturnValue(mockOidcTokenProvider);

        // Create Gantt instance with mocked dependencies
        gantt = new Gantt({
            appLogStoreUri: 'https://test-logstore.com',
            oidcUri: 'https://test-oidc.com',
            console: mockConsole,
            uuAppLogStoreClientFactory: mockUuAppLogStoreClientFactory,
            oidcTokenProviderFactory: mockOidcTokenProviderFactory
        });
    });

    describe('constructor', () => {
        it('should initialize with provided dependencies', () => {
            expect(gantt._appLogStoreUri).toBe('https://test-logstore.com');
            expect(gantt._oidcUri).toBe('https://test-oidc.com');
            expect(gantt._console).toBe(mockConsole);
            expect(gantt._uuAppLogStoreClientFactory).toBe(mockUuAppLogStoreClientFactory);
            expect(gantt._oidcTokenProviderFactory).toBe(mockOidcTokenProviderFactory);
        });

        it('should use default factories when not provided', () => {
            const ganttWithDefaults = new Gantt({
                appLogStoreUri: 'https://test-logstore.com',
                oidcUri: 'https://test-oidc.com'
            });

            expect(ganttWithDefaults._uuAppLogStoreClientFactory).toBeDefined();
            expect(ganttWithDefaults._oidcTokenProviderFactory).toBeDefined();
            expect(ganttWithDefaults._console).toBe(console);
        });
    });

    describe('_renderLogDetail', () => {
        const mockLogItem = {
            traceId: 'test-trace-id',
            urlPath: 'ues:TEST-APP:TEST-AWID/testUseCase',
            eventTime: '2023-01-01T10:00:00.000Z',
            responseTime: 1000
        };

        beforeEach(() => {
            mockOidcTokenProvider.getToken.mockResolvedValue({
                get: jest.fn().mockResolvedValue('mock-token')
            });
        });

        it('should handle successful audit logs retrieval', async () => {
            const mockAuditLogs = {
                itemList: [{
                    logData: {
                        log: {
                            traceId: 'test-trace-id',
                            duration: 1000
                        }
                    }
                }]
            };

            mockUuAppLogStoreClient.getAuditLogs.mockResolvedValue(mockAuditLogs);

            await gantt._renderLogDetail(mockLogItem);

            expect(mockUuAppLogStoreClientFactory).toHaveBeenCalledWith({
                oidcToken: expect.any(Object),
                baseUri: 'https://test-logstore.com'
            });

            expect(mockUuAppLogStoreClient.getAuditLogs).toHaveBeenCalledWith({
                filterMap: {
                    logTypeCode: ["uuApp/perfMon"],
                    requestId: 'test-trace-id'
                }
            });

            expect(mockConsole.log).toHaveBeenCalledWith("Perfmon output (compact view):");
        });

        it('should handle warnings and attempt fallback search', async () => {
            const mockAuditLogsWithWarnings = {
                uuAppErrorMap: {
                    unsupportedKeyList: ['requestId']
                },
                itemList: []
            };

            const mockFallbackAuditLogs = {
                itemList: [{
                    requestId: 'test-trace-id',
                    logData: {
                        log: {
                            traceId: 'test-trace-id',
                            duration: 1000
                        }
                    }
                }]
            };

            mockUuAppLogStoreClient.getAuditLogs
                .mockResolvedValueOnce(mockAuditLogsWithWarnings)
                .mockResolvedValueOnce(mockFallbackAuditLogs);

            await gantt._renderLogDetail(mockLogItem);

            expect(mockConsole.error).toHaveBeenCalledWith(
                expect.stringContaining("Warning(s) found in uuApp response:")
            );

            expect(mockConsole.log).toHaveBeenCalledWith(
                expect.stringContaining("Attempting fallback search using logTime and usecase...")
            );

            expect(mockConsole.log).toHaveBeenCalledWith(
                expect.stringContaining("Fallback search successful!")
            );

            // Verify fallback search was called with correct parameters
            expect(mockUuAppLogStoreClient.getAuditLogs).toHaveBeenCalledWith({
                filterMap: {
                    logTypeCode: ["uuApp/perfMon"],
                    logTime: {
                        from: expect.any(String),
                        to: expect.any(String)
                    },
                    useCase: 'testUseCase'
                }
            });
        });

        it('should handle case when no audit logs are found', async () => {
            const mockEmptyAuditLogs = {
                itemList: []
            };

            mockUuAppLogStoreClient.getAuditLogs.mockResolvedValue(mockEmptyAuditLogs);

            await gantt._renderLogDetail(mockLogItem);

            expect(mockConsole.log).toHaveBeenCalledWith(
                `auditLogs not found for traceId: ${mockLogItem.traceId} \n`
            );
        });
    });

    describe('_getAppLogStoreOidcToken', () => {
        it('should create token provider and get token', async () => {
            const mockToken = { get: jest.fn().mockResolvedValue('mock-token') };
            mockOidcTokenProvider.getToken.mockResolvedValue(mockToken);

            const result = await gantt._getAppLogStoreOidcToken('https://test-oidc.com');

            expect(mockOidcTokenProviderFactory).toHaveBeenCalled();
            expect(mockOidcTokenProvider.getToken).toHaveBeenCalledWith({
                authentication: "oidc",
                oidcUri: 'https://test-oidc.com',
                tokenAlias: expect.any(String)
            });
            expect(result).toBe(mockToken);
        });
    });
});

module.exports = {}; 