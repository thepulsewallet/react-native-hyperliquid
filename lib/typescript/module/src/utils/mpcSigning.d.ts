import type { OrderType, CancelOrderRequest, OrderWire, Grouping, Order, Builder, ITypeData } from '../types';
export declare function orderTypeToWire(orderType: OrderType): OrderType;
export declare function getTxObject(action: unknown, activePool: string | null, nonce: number, isMainnet: boolean): Promise<{
    domain: {
        chainId: number;
        name: string;
        verifyingContract: string;
        version: string;
    };
    types: {
        readonly Agent: readonly [{
            readonly name: "source";
            readonly type: "string";
        }, {
            readonly name: "connectionId";
            readonly type: "bytes32";
        }];
    };
    primaryType: string;
    message: {
        source: string;
        connectionId: string;
    };
}>;
export declare function signUserSignedAction(action: any, payloadTypes: Array<{
    name: string;
    type: string;
}>, primaryType: string, isMainnet: boolean): Promise<ITypeData>;
export declare function signUsdTransferAction(action: any, isMainnet: boolean): Promise<ITypeData>;
export declare function signWithdrawFromBridgeAction(action: any, isMainnet: boolean): Promise<ITypeData>;
export declare function signAgent(action: any, isMainnet: boolean): Promise<ITypeData>;
export declare function floatToWire(x: number): string;
export declare function floatToIntForHashing(x: number): number;
export declare function floatToUsdInt(x: number): number;
export declare function getTimestampMs(): number;
export declare function orderToWire(order: Order, asset: number): OrderWire;
export interface CancelOrderResponse {
    status: string;
    response: {
        type: string;
        data: {
            statuses: string[];
        };
    };
}
export declare function cancelOrderToAction(cancelRequest: CancelOrderRequest): any;
export declare function orderWiresToOrderAction(orderWires: OrderWire[], grouping: Grouping, builder?: Builder): any;
//# sourceMappingURL=mpcSigning.d.ts.map