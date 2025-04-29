import { InfoAPI } from './rest/info';
import { ExchangeAPI } from './rest/exchange';
import { WebSocketClient } from './websocket/connection';
import { WebSocketSubscriptions } from './websocket/subscriptions';
import { CustomOperations } from './rest/custom';
import { MpcExchange } from './rest/mpcExchange';
export declare class Hyperliquid {
    info: InfoAPI;
    exchange: ExchangeAPI;
    mpcExchange: MpcExchange | undefined;
    ws: WebSocketClient;
    subscriptions: WebSocketSubscriptions;
    custom: CustomOperations;
    private rateLimiter;
    private symbolConversion;
    private isValidPrivateKey;
    private walletAddress;
    private isSocialAccount;
    constructor(privateKey?: string | null, testnet?: boolean, walletAddress?: string | null, isSocialAccount?: boolean);
    private createAuthenticatedProxy;
    private initializeWithPrivateKey;
    isAuthenticated(): boolean;
    connect(): Promise<void>;
    disconnect(): void;
}
export default Hyperliquid;
//# sourceMappingURL=index.d.ts.map