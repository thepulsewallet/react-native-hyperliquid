import { InfoAPI } from './info';
import { ExchangeAPI } from './exchange';
import type { OrderResponse, TriggerOrderTypeWire } from '../types';
import type { CancelOrderResponse } from '../utils/signing';
import { SymbolConversion } from '../utils/symbolConversion';
export declare class CustomOperations {
    private exchange;
    private infoApi;
    private symbolConversion;
    private walletAddress;
    constructor(exchange: ExchangeAPI, infoApi: InfoAPI, symbolConversion: SymbolConversion, walletAddress?: string | null);
    cancelAllOrders(symbol?: string): Promise<CancelOrderResponse>;
    getAllAssets(): Promise<{
        perp: string[];
        spot: string[];
    }>;
    DEFAULT_SLIPPAGE: number;
    private getSlippagePrice;
    marketOpen(symbol: string, isBuy: boolean, size: number, px?: number, triggers?: TriggerOrderTypeWire[], slippage?: number): Promise<OrderResponse>;
    getTxObjectMarketOpen(symbol: string, isBuy: boolean, size: number, px?: number, triggers?: TriggerOrderTypeWire[], slippage?: number): Promise<OrderResponse>;
    makePositionTpSl(symbol: string, isBuy: boolean, size: number, triggers?: TriggerOrderTypeWire[], slippage?: number): Promise<OrderResponse>;
    marketClose(symbol: string, size?: number, px?: number, slippage?: number, cloid?: string): Promise<OrderResponse>;
    closeAllPositions(slippage?: number): Promise<OrderResponse[]>;
    limitOpen(symbol: string, isBuy: boolean, size: number, px: number, triggers?: TriggerOrderTypeWire[], slippage?: number): Promise<OrderResponse>;
}
//# sourceMappingURL=custom.d.ts.map