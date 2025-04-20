import { encode } from '@msgpack/msgpack';
import {
  AbstractSigner,
  ethers,
  getBytes,
  HDNodeWallet,
  keccak256,
  type Wallet,
} from 'ethers';

import type {
  OrderType,
  Signature,
  CancelOrderRequest,
  OrderWire,
  Grouping,
  Order,
  Builder,
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

export async function signL1Action(
  wallet: Wallet | HDNodeWallet,
  action: unknown,
  activePool: string | null,
  nonce: number,
  isMainnet: boolean
): Promise<Signature> {
  const hash = actionHash(action, activePool, nonce);
  const phantomAgent = constructPhantomAgent(hash, isMainnet);
  const data = {
    domain: phantomDomain,
    types: agentTypes,
    primaryType: 'Agent',
    message: phantomAgent,
  };
  console.log("🚀 ~ data:", data)
  return signInner(wallet, data);
}

export async function signUserSignedAction(
  wallet: Wallet,
  action: any,
  payloadTypes: Array<{ name: string; type: string }>,
  primaryType: string,
  isMainnet: boolean
): Promise<Signature> {
  action.hyperliquidChain = isMainnet ? 'Mainnet' : 'Testnet';

  const domain = {
    name: 'HyperliquidSignTransaction',
    version: '1',
    chainId: hexToNumber(action.signatureChainId),
    verifyingContract: '0x0000000000000000000000000000000000000000',
  } as const;
  const data = {
    domain,
    types: {
      [primaryType]: payloadTypes,
    },
    primaryType,
    message: action,
  };
  return signInner(wallet, data);
}

export async function signUsdTransferAction(
  wallet: Wallet,
  action: any,
  isMainnet: boolean
): Promise<Signature> {
  return signUserSignedAction(
    wallet,
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
  wallet: Wallet,
  action: any,
  isMainnet: boolean
): Promise<Signature> {
  return signUserSignedAction(
    wallet,
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
  wallet: Wallet,
  action: any,
  isMainnet: boolean
): Promise<Signature> {
  return signUserSignedAction(
    wallet,
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

/**
 * Creates the EIP-712 typed data for approving an agent without signing it.
 * This allows external signing of the agent approval message.
 */
export function createAgentTypedData(
  action: any,
  isMainnet: boolean
): any {
  // Set chain based on network
  action.hyperliquidChain = isMainnet ? 'Mainnet' : 'Testnet';

  const domain = {
    name: 'HyperliquidSignTransaction',
    version: '1',
    chainId: hexToNumber(action.signatureChainId),
    verifyingContract: '0x0000000000000000000000000000000000000000',
  } as const;
  
  const payloadTypes = [
    { name: 'hyperliquidChain', type: 'string' },
    { name: 'agentAddress', type: 'address' },
    { name: 'agentName', type: 'string' },
    { name: 'nonce', type: 'uint64' },
  ];
  
  const primaryType = 'HyperliquidTransaction:ApproveAgent';
  
  return {
    domain,
    types: {
      [primaryType]: payloadTypes,
    },
    primaryType,
    message: action,
    action, // Including the original action for convenience
  };
}

/**
 * Creates the EIP-712 typed data for L1 actions without signing it.
 * This allows external signing of action messages.
 */
export function createL1ActionTypedData(
  action: unknown,
  vaultAddress: string | null,
  nonce: number,
  isMainnet: boolean
): any {
  const hash = actionHash(action, vaultAddress, nonce);
  const phantomAgent = constructPhantomAgent(hash, isMainnet);
  
  return {
    domain: phantomDomain,
    types: agentTypes,
    primaryType: 'Agent',
    message: phantomAgent,
    action,
    nonce,
    vaultAddress,
    hash, // Include the hash for reference
  };
}

async function signInner(
  wallet: Wallet | HDNodeWallet,
  data: any
): Promise<Signature> {
  if (isAbstractWalletClient(wallet)) {
    const signature = await wallet.signTypedData({
      domain: data.domain,
      types: data.types,
      primaryType: data.primaryType,
      message: data.message,
    });
    return splitSig(signature);
  } else if (isAbstractSigner(wallet)) {
    const signature = await wallet.signTypedData(
      data.domain,
      data.types,
      data.message
    );
    return splitSig(signature);
  } else {
    throw new Error('Unsupported wallet for signing typed data');
  }
}

/**
 * Converts a string signature to a Signature object with r, s, v components
 */
export function splitSig(sig: string): Signature {
  const { r, s, v } = ethers.Signature.from(sig);
  return { r, s, v };
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

interface AbstractWalletClient {
  signTypedData(params: {
    domain: {
      name: string;
      version: string;
      chainId: number;
      verifyingContract: Hex;
    };
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<Hex>;
}
type Hex = `0x${string}`;

function isAbstractWalletClient(
  client: unknown
): client is AbstractWalletClient {
  return (
    typeof client === 'object' &&
    client !== null &&
    'signTypedData' in client &&
    typeof client.signTypedData === 'function' &&
    client.signTypedData.length === 1
  );
}
function isAbstractSigner(client: unknown): client is AbstractSigner {
  return (
    typeof client === 'object' &&
    client !== null &&
    'signTypedData' in client &&
    typeof client.signTypedData === 'function' &&
    client.signTypedData.length === 3
  );
}
