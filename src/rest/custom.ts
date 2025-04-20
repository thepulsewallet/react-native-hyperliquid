// src/rest/custom.ts

import { ethers } from 'ethers';
import { InfoAPI } from './info';
import { ExchangeAPI } from './exchange';
import type {
  OrderResponse,
  CancelOrderRequest,
  OrderRequest,
  OrderType,
  UserOpenOrders,
  TriggerOrderTypeWire,
  Order,
} from '../types';
import type { CancelOrderResponse } from '../utils/signing';
import { SymbolConversion } from '../utils/symbolConversion';

export class CustomOperations {
  private exchange: ExchangeAPI;
  private infoApi: InfoAPI;
  private wallet: ethers.Wallet;
  private symbolConversion: SymbolConversion;
  private walletAddress: string | null;

  /**
   * Constructor for CustomOperations class.
   *
   * @param exchange - The ExchangeAPI instance.
   * @param infoApi - The InfoAPI instance.
   * @param privateKey - The Ethereum wallet private key.
   * @param symbolConversion - The SymbolConversion instance.
   * @param walletAddress - The Ethereum wallet address, optional.
   */
  constructor(
    exchange: ExchangeAPI,
    infoApi: InfoAPI,
    privateKey: string,
    symbolConversion: SymbolConversion,
    walletAddress: string | null = null
  ) {
    this.exchange = exchange;
    this.infoApi = infoApi;
    this.wallet = null
    this.symbolConversion = symbolConversion;
    this.walletAddress = walletAddress;
  }

  /**
   * Cancels all open orders for a given symbol or all symbols if no symbol is provided.
   *
   * @param symbol - The symbol for which to cancel orders, optional.
   * @returns A promise that resolves to the CancelOrderResponse.
   */
  async cancelAllOrders(symbol?: string): Promise<CancelOrderResponse> {
    try {
      const address = this.walletAddress || this.wallet.address;
      const openOrders: UserOpenOrders =
        await this.infoApi.getUserOpenOrders(address);

      let ordersToCancel: UserOpenOrders;

      for (let order of openOrders) {
        order.coin = await this.symbolConversion.convertSymbol(order.coin);
      }

      if (symbol) {
        ordersToCancel = openOrders.filter(
          (order: any) => order.coin === symbol
        );
      } else {
        ordersToCancel = openOrders;
      }

      if (ordersToCancel.length === 0) {
        throw new Error('No orders to cancel');
      }

      const cancelRequests: CancelOrderRequest[] = ordersToCancel.map(
        (order: any) => ({
          coin: order.coin,
          o: order.oid,
        })
      );

      const response = await this.exchange.cancelOrder(cancelRequests);
      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Retrieves all assets available for trading.
   *
   * @returns A promise that resolves to an object containing arrays of perpetual and spot assets.
   */
  async getAllAssets(): Promise<{ perp: string[]; spot: string[] }> {
    return await this.symbolConversion.getAllAssets();
  }

  DEFAULT_SLIPPAGE = 0.05;

  /**
   * Calculates the slippage price for a given symbol, direction, and slippage percentage.
   *
   * @param symbol - The trading symbol.
   * @param isBuy - Indicates if the order is a buy or sell.
   * @param slippage - The slippage percentage.
   * @param px - The price, optional.
   * @returns A promise that resolves to the slippage price.
   */
  private async getSlippagePrice(
    symbol: string,
    isBuy: boolean,
    slippage: number,
    px?: number
  ): Promise<number> {
    const convertedSymbol = await this.symbolConversion.convertSymbol(symbol);
    if (!px) {
      const allMids = await this.infoApi.getAllMids();
      px = Number(allMids[convertedSymbol]);
    }

    const isSpot = symbol.includes('-SPOT');
    //If not isSpot count how many decimals price has to use the same amount for rounding
    const decimals = px.toString().split('.')[1]?.length || 1;

    px *= isBuy ? 1 + slippage : 1 - slippage;
    return Number(px.toFixed(isSpot ? 8 : decimals - 1));
  }

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
  async marketOpen(
    symbol: string,
    isBuy: boolean,
    size: number,
    px?: number,
    triggers?: TriggerOrderTypeWire[],
    slippage: number = this.DEFAULT_SLIPPAGE
  ): Promise<OrderResponse> {
    const convertedSymbol = await this.symbolConversion.convertSymbol(symbol);
    const slippagePrice = await this.getSlippagePrice(
      convertedSymbol,
      isBuy,
      slippage,
      px
    );

    const orderType: OrderType = {
      limit: { tif: 'FrontendMarket' },
    } as OrderType;

    const orders: Order[] = [
      {
        coin: convertedSymbol,
        is_buy: isBuy,
        sz: size,
        limit_px: slippagePrice,
        order_type: orderType,
        reduce_only: false,
      },
    ];

    if (triggers) {
      for (const trigger of triggers) {
        const limitSlippage = await this.getSlippagePrice(
          convertedSymbol,
          !isBuy,
          slippage,
          Number(trigger.triggerPx)
        );
        orders.push({
          coin: convertedSymbol,
          is_buy: !isBuy,
          sz: 0,
          limit_px: limitSlippage,
          order_type: {
            trigger: trigger,
          },
          reduce_only: true,
        });
      }
    }

    const orderRequest: OrderRequest = {
      orders: orders,
      grouping: triggers && triggers.length > 0 ? 'normalTpsl' : 'na',
    };

    return this.exchange.placeOrder(orderRequest);
  }

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
  async makePositionTpSl(
    symbol: string,
    isBuy: boolean,
    size: number,
    triggers?: TriggerOrderTypeWire[],
    slippage: number = this.DEFAULT_SLIPPAGE
  ): Promise<OrderResponse> {
    const convertedSymbol = await this.symbolConversion.convertSymbol(symbol);

    const orders: Order[] = [];
    if (triggers) {
      for (const trigger of triggers) {
        const limitSlippage = await this.getSlippagePrice(
          convertedSymbol,
          !isBuy,
          slippage,
          Number(trigger.triggerPx)
        );
        orders.push({
          coin: convertedSymbol,
          is_buy: !isBuy,
          sz: size,
          limit_px: limitSlippage,
          order_type: {
            trigger: trigger,
          },
          reduce_only: true,
        });
      }
    }

    const orderRequest: OrderRequest = {
      orders: orders,
      grouping: 'positionTpsl',
    };

    return this.exchange.placeOrdersTpSl(orderRequest);
  }

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
  async marketClose(
    symbol: string,
    size?: number,
    px?: number,
    slippage: number = this.DEFAULT_SLIPPAGE,
    cloid?: string
  ): Promise<OrderResponse> {
    const convertedSymbol = await this.symbolConversion.convertSymbol(symbol);
    const address = this.walletAddress || this.wallet.address;
    const positions =
      await this.infoApi.perpetuals.getClearinghouseState(address);
    for (const position of positions.assetPositions) {
      const item = position.position;
      if (convertedSymbol !== item.coin) {
        continue;
      }
      const szi = parseFloat(item.szi);
      const closeSize = size || Math.abs(szi);
      const isBuy = szi < 0;

      // Get aggressive Market Price
      const slippagePrice = await this.getSlippagePrice(
        convertedSymbol,
        isBuy,
        slippage,
        px
      );

      // Market Order is an aggressive Limit Order IoC
      const orderRequest: OrderRequest = {
        coin: convertedSymbol,
        is_buy: isBuy,
        sz: closeSize,
        limit_px: slippagePrice,
        order_type: { limit: { tif: 'Ioc' } } as OrderType,
        reduce_only: true,
      };

      if (cloid) {
        orderRequest.cloid = cloid;
      }

      return this.exchange.placeOrder(orderRequest);
    }

    throw new Error(`No position found for ${convertedSymbol}`);
  }

  /**
   * Closes all open positions for all symbols.
   *
   * @param slippage - The slippage percentage, default is DEFAULT_SLIPPAGE.
   * @returns A promise that resolves to an array of OrderResponse.
   */
  async closeAllPositions(
    slippage: number = this.DEFAULT_SLIPPAGE
  ): Promise<OrderResponse[]> {
    try {
      const address = this.walletAddress || this.wallet.address;
      const positions =
        await this.infoApi.perpetuals.getClearinghouseState(address);
      const closeOrders: Promise<OrderResponse>[] = [];

      for (const position of positions.assetPositions) {
        const item = position.position;
        if (parseFloat(item.szi) !== 0) {
          const symbol = await this.symbolConversion.convertSymbol(
            item.coin,
            'forward'
          );
          closeOrders.push(
            this.marketClose(symbol, undefined, undefined, slippage)
          );
        }
      }

      return await Promise.all(closeOrders);
    } catch (error) {
      throw error;
    }
  }

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
  async limitOpen(
    symbol: string,
    isBuy: boolean,
    size: number,
    px: number,
    triggers?: TriggerOrderTypeWire[],
    slippage: number = this.DEFAULT_SLIPPAGE
  ): Promise<OrderResponse> {
    const convertedSymbol = await this.symbolConversion.convertSymbol(symbol);
    const orderType: OrderType = { limit: { tif: 'Gtc' } } as OrderType;
    const orders: Order[] = [
      {
        coin: convertedSymbol,
        is_buy: isBuy,
        sz: size,
        limit_px: px,
        order_type: orderType,
        reduce_only: false,
      },
    ];

    if (triggers) {
      for (const trigger of triggers) {
        const limitSlippage = await this.getSlippagePrice(
          convertedSymbol,
          !isBuy,
          slippage,
          Number(trigger.triggerPx)
        );
        orders.push({
          coin: convertedSymbol,
          is_buy: !isBuy,
          sz: 0,
          limit_px: limitSlippage,
          order_type: {
            trigger: trigger,
          },
          reduce_only: true,
        });
      }
    }

    const orderRequest: OrderRequest = {
      orders: orders,
      grouping: triggers && triggers!.length > 0 ? 'normalTpsl' : 'na',
    };

    return this.exchange.placeOrder(orderRequest);
  }
}
