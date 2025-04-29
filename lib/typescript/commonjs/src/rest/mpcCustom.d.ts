import { InfoAPI } from './info';
import { MpcExchange } from './mpcExchange';
import type { TriggerOrderTypeWire } from '../types';
import { SymbolConversion } from '../utils/symbolConversion';
export declare class MpcCustomOperations {
    private exchange;
    private infoApi;
    private symbolConversion;
    private walletAddress;
    constructor(exchange: MpcExchange, infoApi: InfoAPI, symbolConversion: SymbolConversion, walletAddress: string);
    cancelAllOrders(symbol?: string): Promise<any>;
    getAllAssets(): Promise<{
        perp: string[];
        spot: string[];
    }>;
    DEFAULT_SLIPPAGE: number;
    private getSlippagePrice;
    marketOpen(symbol: string, isBuy: boolean, size: number, px?: number, triggers?: TriggerOrderTypeWire[], slippage?: number): Promise<any>;
    getTxObjectMarketOpen(symbol: string, isBuy: boolean, size: number, px?: number, triggers?: TriggerOrderTypeWire[], slippage?: number): Promise<any>;
    makePositionTpSl(symbol: string, isBuy: boolean, size: number, triggers?: TriggerOrderTypeWire[], slippage?: number): Promise<any>;
    marketClose(symbol: string, size?: number, px?: number, slippage?: number, cloid?: string): Promise<any>;
    closeAllPositions(slippage?: number): Promise<any[]>;
    limitOpen(symbol: string, isBuy: boolean, size: number, px: number, triggers?: TriggerOrderTypeWire[], slippage?: number): Promise<any>;
}
//# sourceMappingURL=mpcCustom.d.ts.map