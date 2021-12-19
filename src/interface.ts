import { Context as BaseContext, SessionFlavor } from 'grammy';

export interface Session {
  step: 'idle' | 'wallet' | 'ratio' | 'done';
  wallet?: string;
  ratio?: number;
  chatId?: string;
}

export type MyContext = BaseContext & SessionFlavor<Session>;

export interface PositionDetail {
  assetName: string;
  assetPrice: number;
  assetAmount: number;
  collateralAmount: number;
  collateralRatio: number;
}
