import { InfoAPI } from './info';
import { ExchangeAPI } from './exchange';
import type { OrderResponse, TriggerOrderTypeWire } from '../types';
import type { CancelOrderResponse } from '../utils/signing';
import { SymbolConversion } from '../utils/symbolConversion';
export declare class CustomOperations {
    private exchange;
    private infoApi;
    private wallet;
    private symbolConversion;
    private walletAddress;
    /**
     * Constructor for CustomOperations class.
     *
     * @param exchange - The ExchangeAPI instance.
     * @param infoApi - The InfoAPI instance.
     * @param privateKey - The Ethereum wallet private key.
     * @param symbolConversion - The SymbolConversion instance.
     * @param walletAddress - The Ethereum wallet address, optional.
     */
    constructor(exchange: ExchangeAPI, infoApi: InfoAPI, privateKey: string, symbolConversion: SymbolConversion, walletAddress?: string | null);
    /**
     * Cancels all open orders for a given symbol or all symbols if no symbol is provided.
     *
     * @param symbol - The symbol for which to cancel orders, optional.
     * @returns A promise that resolves to the CancelOrderResponse.
     */
    cancelAllOrders(symbol?: string): Promise<CancelOrderResponse>;
    /**
     * Retrieves all assets available for trading.
     *
     * @returns A promise that resolves to an object containing arrays of perpetual and spot assets.
     */
    getAllAssets(): Promise<{
        perp: string[];
        spot: string[];
    }>;
    DEFAULT_SLIPPAGE: number;
    /**
     * Calculates the slippage price for a given symbol, direction, and slippage percentage.
     *
     * @param symbol - The trading symbol.
     * @param isBuy - Indicates if the order is a buy or sell.
     * @param slippage - The slippage percentage.
     * @param px - The price, optional.
     * @returns A promise that resolves to the slippage price.
     */
    private getSlippagePrice;
    /**
     * Places a market order for a given symbol, direction, size, and optional price.
     *
     * @param symbol - The trading symbol.
     * @param isBuy - Indicates if the order is a buy or sell.
     * @param size - The order size.
     * @param px - The price, optional.
     * @param triggers - Trigger orders, optional.
     * @param slippage - The slippage percentage, default is DEFAULT_SLIPPAGE.
     * @returns A promise that resolves to the OrderResponse.
     */
    marketOpen(symbol: string, isBuy: boolean, size: number, px?: number, triggers?: TriggerOrderTypeWire[], slippage?: number): Promise<OrderResponse>;
    /**
     * Places a position take profit/stop loss order for a given symbol, direction, size, and optional triggers.
     *
     * @param symbol - The trading symbol.
     * @param isBuy - Indicates if the order is a buy or sell.
     * @param size - The order size.
     * @param triggers - Trigger orders, optional.
     * @param slippage - The slippage percentage, default is DEFAULT_SLIPPAGE.
     * @returns A promise that resolves to the OrderResponse.
     */
    makePositionTpSl(symbol: string, isBuy: boolean, size: number, triggers?: TriggerOrderTypeWire[], slippage?: number): Promise<OrderResponse>;
    /**
     * Places a market close order for a given symbol, optional size, optional price, and slippage percentage.
     *
     * @param symbol - The trading symbol.
     * @param size - The order size, optional.
     * @param px - The price, optional.
     * @param slippage - The slippage percentage, default is DEFAULT_SLIPPAGE.
     * @param cloid - The client order ID, optional.
     * @returns A promise that resolves to the OrderResponse.
     */
    marketClose(symbol: string, size?: number, px?: number, slippage?: number, cloid?: string): Promise<OrderResponse>;
    /**
     * Closes all open positions for all symbols.
     *
     * @param slippage - The slippage percentage, default is DEFAULT_SLIPPAGE.
     * @returns A promise that resolves to an array of OrderResponse.
     */
    closeAllPositions(slippage?: number): Promise<OrderResponse[]>;
    /**
     * Places a limit order for a given symbol, direction, size, price, and optional triggers.
     *
     * @param symbol - The trading symbol.
     * @param isBuy - Indicates if the order is a buy or sell.
     * @param size - The order size.
     * @param px - The price.
     * @param triggers - Trigger orders, optional.
     * @param slippage - The slippage percentage, default is DEFAULT_SLIPPAGE.
     * @returns A promise that resolves to the OrderResponse.
     */
    limitOpen(symbol: string, isBuy: boolean, size: number, px: number, triggers?: TriggerOrderTypeWire[], slippage?: number): Promise<OrderResponse>;
}
//# sourceMappingURL=custom.d.ts.map