import { ethers } from 'ethers';
import { RateLimiter } from '../utils/rateLimiter';
import { HttpApi } from '../utils/helpers';
import { InfoAPI } from './info';
import {
  signL1Action,
  orderWiresToOrderAction,
  type CancelOrderResponse,
  signUserSignedAction,
  signUsdTransferAction,
  signWithdrawFromBridgeAction,
  orderToWire,
  getTxObject,
} from '../utils/signing';
import * as CONSTANTS from '../types/constants';

import type { CancelOrderRequest, Order, OrderRequest } from '../types/index';

import { ExchangeType, ENDPOINTS } from '../types/constants';
import { SymbolConversion } from '../utils/symbolConversion';

export class ExchangeAPI {
  private wallet: ethers.Wallet | undefined;
  private httpApi: HttpApi;
  private symbolConversion: SymbolConversion;
  private IS_MAINNET = true;

  constructor(
    testnet: boolean,
    privateKey: string | null,
    _: InfoAPI,
    rateLimiter: RateLimiter,
    symbolConversion: SymbolConversion
  ) {
    const baseURL = testnet
      ? CONSTANTS.BASE_URLS.TESTNET
      : CONSTANTS.BASE_URLS.PRODUCTION;
    this.IS_MAINNET = !testnet;
    this.httpApi = new HttpApi(baseURL, ENDPOINTS.EXCHANGE, rateLimiter);
    this.wallet = privateKey ? new ethers.Wallet(privateKey) : undefined;
    this.symbolConversion = symbolConversion;
  }

  private async getAssetIndex(symbol: string): Promise<number> {
    const index = await this.symbolConversion.getAssetIndex(symbol);
    if (index === undefined) {
      throw new Error(`Unknown asset: ${symbol}`);
    }
    return index;
  }

  // Create a normal order
  async placeOrder(orderRequest: OrderRequest): Promise<any> {
    const {
      orders,
      vaultAddress = null,
      grouping = 'na',
      builder,
    } = orderRequest;
    const ordersArray = orders ?? [orderRequest as Order];

    try {
      const assetIndexCache = new Map<string, number>();

      const orderWires = await Promise.all(
        ordersArray.map(async (o: Order) => {
          let assetIndex = assetIndexCache.get(o.coin);
          if (assetIndex === undefined) {
            assetIndex = await this.getAssetIndex(o.coin);
            assetIndexCache.set(o.coin, assetIndex);
          }
          return orderToWire(o, assetIndex);
        })
      );

      const actions = orderWiresToOrderAction(orderWires, grouping, builder);
      const nonce = Date.now();
      const signature = await signL1Action(
        this.wallet,
        actions,
        vaultAddress,
        nonce,
        this.IS_MAINNET
      );

      const payload = {
        action: actions,
        isFrontend: true,
        nonce,
        signature,
        vaultAddress,
      };

      const res = await this.httpApi.makeRequest(payload, 1);
      return res;
    } catch (error) {
      throw error;
    }
  }

  async getTxObjectPlaceOrder(orderRequest: OrderRequest): Promise<any> {
    const {
      orders,
      vaultAddress = null,
      grouping = 'na',
      builder,
    } = orderRequest;
    const ordersArray = orders ?? [orderRequest as Order];

    try {
      const assetIndexCache = new Map<string, number>();

      const orderWires = await Promise.all(
        ordersArray.map(async (o: Order) => {
          let assetIndex = assetIndexCache.get(o.coin);
          if (assetIndex === undefined) {
            assetIndex = await this.getAssetIndex(o.coin);
            assetIndexCache.set(o.coin, assetIndex);
          }
          return orderToWire(o, assetIndex);
        })
      );

      const actions = orderWiresToOrderAction(orderWires, grouping, builder);
      const nonce = Date.now();
      const signature = await getTxObject(
        actions,
        vaultAddress,
        nonce,
        this.IS_MAINNET
      );
      return {
        action: actions,
        isFrontend: true,
        nonce,
        signature,
        vaultAddress,
      };
    } catch (error) {
      throw error;
    }
  }

  // Create a TP/SL order
  async placeOrdersTpSl(orderRequest: OrderRequest): Promise<any> {
    const { orders, vaultAddress = null, builder } = orderRequest;
    const ordersArray = orders ?? [orderRequest as Order];
    const grouping = 'positionTpsl';

    try {
      const assetIndexCache = new Map<string, number>();
      const orderWires = await Promise.all(
        ordersArray.map(async (o: Order) => {
          let assetIndex = await this.getAssetIndex(o.coin);
          if (assetIndex === undefined) {
            assetIndex = await this.getAssetIndex(o.coin);
            assetIndexCache.set(o.coin, assetIndex);
          }
          return orderToWire(o, assetIndex);
        })
      );

      const actions = orderWiresToOrderAction(orderWires, grouping, builder);
      const nonce = Date.now();
      const signature = await signL1Action(
        this.wallet,
        actions,
        orderRequest.vaultAddress || null,
        nonce,
        this.IS_MAINNET
      );

      const payload = { action: actions, nonce, signature, vaultAddress };

      const res = await this.httpApi.makeRequest(payload, 1);
      return res;
    } catch (error) {
      throw error;
    }
  }

  //Cancel using order id (oid)
  async cancelOrder(
    cancelRequests: CancelOrderRequest | CancelOrderRequest[]
  ): Promise<CancelOrderResponse> {
    try {
      const cancels = Array.isArray(cancelRequests)
        ? cancelRequests
        : [cancelRequests];

      // Ensure all cancel requests have asset indices
      const cancelsWithIndices = await Promise.all(
        cancels.map(async (req) => ({
          ...req,
          a: await this.getAssetIndex(req.coin),
        }))
      );

      const action = {
        type: ExchangeType.CANCEL,
        cancels: cancelsWithIndices.map(({ a, o }) => ({ a, o })),
      };

      const nonce = Date.now();
      const signature = await signL1Action(
        this.wallet,
        action,
        null,
        nonce,
        this.IS_MAINNET
      );

      const payload = { action, nonce, signature };
      return this.httpApi.makeRequest(payload, 1);
    } catch (error) {
      throw error;
    }
  }

  //Cancel using a CLOID
  async cancelOrderByCloid(symbol: string, cloid: string): Promise<any> {
    try {
      const assetIndex = await this.getAssetIndex(symbol);
      const action = {
        type: ExchangeType.CANCEL_BY_CLOID,
        cancels: [{ asset: assetIndex, cloid }],
      };
      const nonce = Date.now();
      const signature = await signL1Action(
        this.wallet,
        action,
        null,
        nonce,
        this.IS_MAINNET
      );

      const payload = { action, nonce, signature };
      return this.httpApi.makeRequest(payload, 1);
    } catch (error) {
      throw error;
    }
  }

  //Modify a single order
  async modifyOrder(oid: number, orderRequest: Order): Promise<any> {
    try {
      const assetIndex = await this.getAssetIndex(orderRequest.coin);

      const orderWire = orderToWire(orderRequest, assetIndex);
      const action = {
        type: ExchangeType.MODIFY,
        oid,
        order: orderWire,
      };
      const nonce = Date.now();
      const signature = await signL1Action(
        this.wallet,
        action,
        null,
        nonce,
        this.IS_MAINNET
      );

      const payload = { action, nonce, signature };
      return this.httpApi.makeRequest(payload, 1);
    } catch (error) {
      throw error;
    }
  }

  //Modify multiple orders at once
  async batchModifyOrders(
    modifies: Array<{ oid: number; order: Order }>
  ): Promise<any> {
    try {
      // First, get all asset indices in parallel
      const assetIndices = await Promise.all(
        modifies.map((m) => this.getAssetIndex(m.order.coin))
      );

      const action = {
        type: ExchangeType.BATCH_MODIFY,
        modifies: modifies.map((m, index) => {
          if (!assetIndices[index]) throw Error('non-existent assets');
          return {
            oid: m.oid,
            order: orderToWire(m.order, assetIndices[index]),
          };
        }),
      };

      const nonce = Date.now();
      const signature = await signL1Action(
        this.wallet,
        action,
        null,
        nonce,
        this.IS_MAINNET
      );

      const payload = { action, nonce, signature };
      return this.httpApi.makeRequest(payload, 1);
    } catch (error) {
      throw error;
    }
  }

  //Update leverage. Set leverageMode to "cross" if you want cross leverage, otherwise it'll set it to "isolated by default"
  async updateLeverage(
    symbol: string,
    leverageMode: string,
    leverage: number
  ): Promise<any> {
    try {
      const assetIndex = await this.getAssetIndex(symbol);
      const action = {
        type: ExchangeType.UPDATE_LEVERAGE,
        asset: assetIndex,
        isCross: leverageMode === 'cross',
        leverage: leverage,
      };
      const nonce = Date.now();
      const signature = await signL1Action(
        this.wallet,
        action,
        null,
        nonce,
        this.IS_MAINNET
      );

      const payload = { action, nonce, signature };
      return this.httpApi.makeRequest(payload, 1);
    } catch (error) {
      throw error;
    }
  }

  //Update how much margin there is on a perps position
  async updateIsolatedMargin(
    symbol: string,
    isBuy: boolean,
    ntli: number
  ): Promise<any> {
    try {
      const assetIndex = await this.getAssetIndex(symbol);
      const action = {
        type: ExchangeType.UPDATE_ISOLATED_MARGIN,
        asset: assetIndex,
        isBuy,
        ntli,
      };
      const nonce = Date.now();
      const signature = await signL1Action(
        this.wallet,
        action,
        null,
        nonce,
        this.IS_MAINNET
      );

      const payload = { action, nonce, signature };
      return this.httpApi.makeRequest(payload, 1);
    } catch (error) {
      throw error;
    }
  }

  //Takes from the perps wallet and sends to another wallet without the $1 fee (doesn't touch bridge, so no fees)
  async usdTransfer(destination: string, amount: number): Promise<any> {
    try {
      const action = {
        type: ExchangeType.USD_SEND,
        hyperliquidChain: this.IS_MAINNET ? 'Mainnet' : 'Testnet',
        signatureChainId: this.IS_MAINNET ? '0xa4b1' : '0x66eee',
        destination: destination,
        amount: amount.toString(),
        time: Date.now(),
      };
      const signature = await signUsdTransferAction(
        this.wallet,
        action,
        this.IS_MAINNET
      );

      const payload = { action, nonce: action.time, signature };
      return this.httpApi.makeRequest(payload, 1);
    } catch (error) {
      throw error;
    }
  }

  //Transfer SPOT assets i.e PURR to another wallet (doesn't touch bridge, so no fees)
  async spotTransfer(
    destination: string,
    token: string,
    amount: string
  ): Promise<any> {
    try {
      const action = {
        type: ExchangeType.SPOT_SEND,
        hyperliquidChain: this.IS_MAINNET ? 'Mainnet' : 'Testnet',
        signatureChainId: this.IS_MAINNET ? '0xa4b1' : '0x66eee',
        destination,
        token,
        amount,
        time: Date.now(),
      };
      const signature = await signUserSignedAction(
        this.wallet,
        action,
        [
          { name: 'hyperliquidChain', type: 'string' },
          { name: 'destination', type: 'string' },
          { name: 'token', type: 'string' },
          { name: 'amount', type: 'string' },
          { name: 'time', type: 'uint64' },
        ],
        'HyperliquidTransaction:SpotSend',
        this.IS_MAINNET
      );

      const payload = { action, nonce: action.time, signature };
      return this.httpApi.makeRequest(payload, 1);
    } catch (error) {
      throw error;
    }
  }

  //Withdraw USDC, this txn goes across the bridge and costs $1 in fees as of writing this
  async initiateWithdrawal(destination: string, amount: number): Promise<any> {
    try {
      const action = {
        type: ExchangeType.WITHDRAW,
        hyperliquidChain: this.IS_MAINNET ? 'Mainnet' : 'Testnet',
        signatureChainId: this.IS_MAINNET ? '0xa4b1' : '0x66eee',
        destination: destination,
        amount: amount.toString(),
        time: Date.now(),
      };
      const signature = await signWithdrawFromBridgeAction(
        this.wallet,
        action,
        this.IS_MAINNET
      );

      const payload = { action, nonce: action.time, signature };
      return this.httpApi.makeRequest(payload, 1);
    } catch (error) {
      throw error;
    }
  }

  //Transfer between spot and perpetual wallets (intra-account transfer)
  async transferBetweenSpotAndPerp(
    usdc: number,
    toPerp: boolean
  ): Promise<any> {
    try {
      const nonce = Date.now();

      const action = {
        amount: usdc.toString(),
        hyperliquidChain: this.IS_MAINNET ? 'Mainnet' : 'Testnet',
        nonce,
        signatureChainId: this.IS_MAINNET ? '0xa4b1' : '0x66eee',
        toPerp: toPerp,
        type: ExchangeType.USD_CLASS_TRANSFER,
      };

      const signature = await signUserSignedAction(
        this.wallet,
        action,
        [
          { name: 'hyperliquidChain', type: 'string' },
          { name: 'amount', type: 'string' },
          { name: 'toPerp', type: 'bool' },
          { name: 'nonce', type: 'uint64' },
        ],
        'HyperliquidTransaction:UsdClassTransfer',
        this.IS_MAINNET
      );
      const payload = { action, signature, nonce };
      const res = await this.httpApi.makeRequest(payload, 1);
      return res;
    } catch (error) {
      throw error;
    }
  }

  //Schedule a cancel for a given time (in ms) //Note: Only available once you've traded $1 000 000 in volume
  async scheduleCancel(time: number | null): Promise<any> {
    try {
      const action = { type: ExchangeType.SCHEDULE_CANCEL, time };
      const nonce = Date.now();
      const signature = await signL1Action(
        this.wallet,
        action,
        null,
        nonce,
        this.IS_MAINNET
      );

      const payload = { action, nonce, signature };
      return this.httpApi.makeRequest(payload, 1);
    } catch (error) {
      throw error;
    }
  }

  //Transfer between vault and perpetual wallets (intra-account transfer)
  async vaultTransfer(
    vaultAddress: string,
    isDeposit: boolean,
    usd: number
  ): Promise<any> {
    try {
      const action = {
        type: ExchangeType.VAULT_TRANSFER,
        vaultAddress,
        isDeposit,
        usd,
      };
      const nonce = Date.now();
      const signature = await signL1Action(
        this.wallet,
        action,
        null,
        nonce,
        this.IS_MAINNET
      );

      const payload = { action, nonce, signature };
      return this.httpApi.makeRequest(payload, 1);
    } catch (error) {
      throw error;
    }
  }

  async setReferrer(code: string): Promise<any> {
    try {
      const action = {
        type: ExchangeType.SET_REFERRER,
        code,
      };
      const nonce = Date.now();
      const signature = await signL1Action(
        this.wallet,
        action,
        null,
        nonce,
        this.IS_MAINNET
      );

      const payload = { action, nonce, signature };
      return this.httpApi.makeRequest(payload, 1);
    } catch (error) {
      throw error;
    }
  }

  async callRequest(payload: object, weight: number): Promise<any> {
    return this.httpApi.makeRequest(payload, weight);
  }
}
