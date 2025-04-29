import { RateLimiter } from '../utils/rateLimiter';
import { InfoAPI } from './info';
import { type CancelOrderResponse } from '../utils/signing';
import type { CancelOrderRequest, Order, OrderRequest } from '../types/index';
import { SymbolConversion } from '../utils/symbolConversion';
export declare class ExchangeAPI {
    private wallet;
    private httpApi;
    private symbolConversion;
    private IS_MAINNET;
    constructor(testnet: boolean, privateKey: string | null, _: InfoAPI, rateLimiter: RateLimiter, symbolConversion: SymbolConversion);
    private getAssetIndex;
    placeOrder(orderRequest: OrderRequest): Promise<any>;
    getTxObjectPlaceOrder(orderRequest: OrderRequest): Promise<any>;
    placeOrdersTpSl(orderRequest: OrderRequest): Promise<any>;
    cancelOrder(cancelRequests: CancelOrderRequest | CancelOrderRequest[]): Promise<CancelOrderResponse>;
    cancelOrderByCloid(symbol: string, cloid: string): Promise<any>;
    modifyOrder(oid: number, orderRequest: Order): Promise<any>;
    batchModifyOrders(modifies: Array<{
        oid: number;
        order: Order;
    }>): Promise<any>;
    updateLeverage(symbol: string, leverageMode: string, leverage: number): Promise<any>;
    updateIsolatedMargin(symbol: string, isBuy: boolean, ntli: number): Promise<any>;
    usdTransfer(destination: string, amount: number): Promise<any>;
    spotTransfer(destination: string, token: string, amount: string): Promise<any>;
    initiateWithdrawal(destination: string, amount: number): Promise<any>;
    transferBetweenSpotAndPerp(usdc: number, toPerp: boolean): Promise<any>;
    scheduleCancel(time: number | null): Promise<any>;
    vaultTransfer(vaultAddress: string, isDeposit: boolean, usd: number): Promise<any>;
    setReferrer(code: string): Promise<any>;
    callRequest(payload: object, weight: number): Promise<any>;
}
//# sourceMappingURL=exchange.d.ts.map