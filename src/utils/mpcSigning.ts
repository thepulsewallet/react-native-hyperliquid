import { encode } from '@msgpack/msgpack';
import { getBytes, keccak256 } from 'ethers';

import type {
  OrderType,
  CancelOrderRequest,
  OrderWire,
  Grouping,
  Order,
  Builder,
  ITypeData,
} from '../types';

const phantomDomain = {
  chainId: 1337,
  name: 'Exchange',
  verifyingContract: '0x0000000000000000000000000000000000000000',
  version: '1',
};

const agentTypes = {
  Agent: [
    { name: 'source', type: 'string' },
    { name: 'connectionId', type: 'bytes32' },
  ],
} as const;

export function orderTypeToWire(orderType: OrderType): OrderType {
  if (orderType.limit) {
    return { limit: orderType.limit };
  } else if (orderType.trigger) {
    return {
      trigger: {
        isMarket: orderType.trigger.isMarket,
        triggerPx: floatToWire(Number(orderType.trigger.triggerPx)),
        tpsl: orderType.trigger.tpsl,
      },
    };
  }
  throw new Error('Invalid order type');
}

function addressToBytes(address: string): Uint8Array {
  return getBytes(address);
}

function actionHash(
  action: unknown,
  vaultAddress: string | null,
  nonce: number
): string {
  const msgPackBytes = encode(action);
  const additionalBytesLength = vaultAddress === null ? 9 : 29;
  const data = new Uint8Array(msgPackBytes.length + additionalBytesLength);
  data.set(msgPackBytes);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  view.setBigUint64(msgPackBytes.length, BigInt(nonce), false);
  if (vaultAddress === null) {
    view.setUint8(msgPackBytes.length + 8, 0);
  } else {
    view.setUint8(msgPackBytes.length + 8, 1);
    data.set(addressToBytes(vaultAddress), msgPackBytes.length + 9);
  }
  return keccak256(data);
}

function constructPhantomAgent(hash: string, isMainnet: boolean) {
  return { source: isMainnet ? 'a' : 'b', connectionId: hash };
}

export async function getTxObject(
  action: unknown,
  activePool: string | null,
  nonce: number,
  isMainnet: boolean
) {
  const hash = actionHash(action, activePool, nonce);
  const phantomAgent = constructPhantomAgent(hash, isMainnet);
  return {
    domain: phantomDomain,
    types: agentTypes,
    primaryType: 'Agent',
    message: phantomAgent,
  };
}

export async function signUserSignedAction(
  action: any,
  payloadTypes: Array<{ name: string; type: string }>,
  primaryType: string,
  isMainnet: boolean
): Promise<ITypeData> {
  action.hyperliquidChain = isMainnet ? 'Mainnet' : 'Testnet';

  const domain = {
    name: 'HyperliquidSignTransaction',
    version: '1',
    chainId: hexToNumber(action.signatureChainId),
    verifyingContract: '0x0000000000000000000000000000000000000000',
  } as const;
  return {
    domain,
    types: {
      [primaryType]: payloadTypes,
    },
    primaryType,
    message: action,
  };
}

export async function signUsdTransferAction(
  action: any,
  isMainnet: boolean
): Promise<ITypeData> {
  return signUserSignedAction(
    action,
    [
      { name: 'hyperliquidChain', type: 'string' },
      { name: 'destination', type: 'string' },
      { name: 'amount', type: 'string' },
      { name: 'time', type: 'uint64' },
    ],
    'HyperliquidTransaction:UsdSend',
    isMainnet
  );
}

export async function signWithdrawFromBridgeAction(
  action: any,
  isMainnet: boolean
): Promise<ITypeData> {
  return signUserSignedAction(
    action,
    [
      { name: 'hyperliquidChain', type: 'string' },
      { name: 'destination', type: 'string' },
      { name: 'amount', type: 'string' },
      { name: 'time', type: 'uint64' },
    ],
    'HyperliquidTransaction:Withdraw',
    isMainnet
  );
}

export async function signAgent(
  action: any,
  isMainnet: boolean
): Promise<ITypeData> {
  return signUserSignedAction(
    action,
    [
      { name: 'hyperliquidChain', type: 'string' },
      { name: 'agentAddress', type: 'address' },
      { name: 'agentName', type: 'string' },
      { name: 'nonce', type: 'uint64' },
    ],
    'HyperliquidTransaction:ApproveAgent',
    isMainnet
  );
}

export function floatToWire(x: number): string {
  const rounded = x.toFixed(8);
  if (Math.abs(parseFloat(rounded) - x) >= 1e-12) {
    throw new Error(`floatToWire causes rounding: ${x}`);
  }
  let normalized = rounded.replace(/\.?0+$/, '');
  if (normalized === '-0') normalized = '0';
  return normalized;
}

export function floatToIntForHashing(x: number): number {
  return floatToInt(x, 8);
}

export function floatToUsdInt(x: number): number {
  return floatToInt(x, 6);
}

function floatToInt(x: number, power: number): number {
  const withDecimals = x * Math.pow(10, power);
  if (Math.abs(Math.round(withDecimals) - withDecimals) >= 1e-3) {
    throw new Error(`floatToInt causes rounding: ${x}`);
  }
  return Math.round(withDecimals);
}

export function getTimestampMs(): number {
  return Date.now();
}

export function orderToWire(order: Order, asset: number): OrderWire {
  const orderWire: OrderWire = {
    a: asset,
    b: order.is_buy,
    p: floatToWire(order.limit_px),
    s: floatToWire(order.sz),
    r: order.reduce_only,
    t: orderTypeToWire(order.order_type),
  };
  if (order.cloid !== undefined) {
    orderWire.c = order.cloid;
  }
  return orderWire;
}

export interface CancelOrderResponse {
  status: string;
  response: {
    type: string;
    data: {
      statuses: string[];
    };
  };
}

export function cancelOrderToAction(cancelRequest: CancelOrderRequest): any {
  return {
    type: 'cancel',
    cancels: [cancelRequest],
  };
}

export function orderWiresToOrderAction(
  orderWires: OrderWire[],
  grouping: Grouping,
  builder?: Builder
): any {
  return {
    type: 'order',
    orders: orderWires,
    grouping: grouping,
    ...(builder !== undefined ? { builder: builder } : {}),
  };
}

function hexToNumber(hex: Hex): number {
  return parseInt(hex, 16);
}

type Hex = `0x${string}`;
