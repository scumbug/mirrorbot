import { Mirror, MirrorMint, TerraswapToken } from '@mirror-protocol/mirror.js';
import { LCDClient } from '@terra-money/terra.js';
import { AUST_CONTRACT, DIVISOR } from './constants';
import { PositionDetail } from './interface';

const mirror: Mirror = new Mirror();
const terra = new LCDClient({
  URL: 'https://lcd.terra.dev',
  chainID: 'columbus-5',
});

const getAUSTPrice = async (): Promise<number> => {
  return parseFloat(
    (await mirror.collateralOracle.getCollateralPrice(AUST_CONTRACT)).rate
  );
};

const getAssetPrice = async (contractAddr: string): Promise<number> => {
  const assetPrice = await mirror.collateralOracle.getCollateralPrice(
    contractAddr
  );

  return parseFloat(assetPrice.rate);
};

const getPositions = async (
  wallet: string
): Promise<Array<MirrorMint.PositionResponse>> => {
  return (await mirror.mint.getPositions(wallet)).positions;
};

export const collateralRatio = async (
  wallet: string
): Promise<PositionDetail[]> => {
  const positions = await getPositions(wallet);
  const positionsDetail = positions.map(async (position) => {
    // Asset metadata
    const assetName = (
      await terra.wasm.contractQuery<TerraswapToken.TokenInfoResponse>(
        position.asset.info.token.contract_addr,
        { token_info: {} }
      )
    ).symbol;

    const assetPrice = await getAssetPrice(
      position.asset.info.token.contract_addr
    );

    // Asset Calculation
    const assetAmount =
      (parseFloat(position.asset.amount) / DIVISOR) * assetPrice;

    // Collateral Calculation
    const collateralAmount =
      (parseFloat(position.collateral.amount) / DIVISOR) *
      (await getAUSTPrice());

    // Ratio
    const collateralRatio = (collateralAmount / assetAmount) * 100;

    return <PositionDetail>{
      assetName,
      assetPrice,
      assetAmount,
      collateralAmount,
      collateralRatio,
    };
  });

  return Promise.all(positionsDetail);
};
