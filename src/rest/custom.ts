// src/rest/custom.ts

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
  private symbolConversion: SymbolConversion;
  private walletAddress: string | null;

  constructor(
    exchange: ExchangeAPI,
    infoApi: InfoAPI,
    symbolConversion: SymbolConversion,
    walletAddress: string | null = null
  ) {
    this.exchange = exchange;
    this.infoApi = infoApi;
    this.symbolConversion = symbolConversion;
    this.walletAddress = walletAddress;
  }

  async cancelAllOrders(symbol?: string): Promise<CancelOrderResponse> {
    try {
      const address = this.walletAddress || '';
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

  async getAllAssets(): Promise<{ perp: string[]; spot: string[] }> {
    return await this.symbolConversion.getAllAssets();
  }

  DEFAULT_SLIPPAGE = 0.05;

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

  async marketOpen(
    symbol: string,
    isBuy: boolean,
    size: number,
    px?: number,
    triggers?: TriggerOrderTypeWire[],
    slippage: number = this.DEFAULT_SLIPPAGE
  ): Promise<OrderResponse> {
    const convertedSymbol = await this.symbolConversion.convertSymbol(symbol);
    console.log('convertedSymbol', convertedSymbol);
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
    console.log('orderRequest', JSON.stringify(orderRequest));
    return this.exchange.placeOrder(orderRequest);
  }

  async getTxObjectMarketOpen(
    symbol: string,
    isBuy: boolean,
    size: number,
    px?: number,
    triggers?: TriggerOrderTypeWire[],
    slippage: number = this.DEFAULT_SLIPPAGE
  ): Promise<OrderResponse> {
    const convertedSymbol = await this.symbolConversion.convertSymbol(symbol);
    console.log('convertedSymbol', convertedSymbol);
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
    console.log('orderRequest', JSON.stringify(orderRequest));
    return this.exchange.getTxObjectPlaceOrder(orderRequest);
  }

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

  async marketClose(
    symbol: string,
    size?: number,
    px?: number,
    slippage: number = this.DEFAULT_SLIPPAGE,
    cloid?: string
  ): Promise<OrderResponse> {
    const convertedSymbol = await this.symbolConversion.convertSymbol(symbol);
    const address = this.walletAddress || '';
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

  async closeAllPositions(
    slippage: number = this.DEFAULT_SLIPPAGE
  ): Promise<OrderResponse[]> {
    try {
      const address = this.walletAddress || '';
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
