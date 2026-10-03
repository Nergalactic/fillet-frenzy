// The one place a real ad SDK plugs in.
//
// showRewardedAd() must resolve to true only if the player watched the ad to the end
// (that's when they earn the reward), and false if they skipped it or no ad was available.
// The game pauses while this promise is pending.
//
// Today it's free: the bonus is granted immediately with no ad.
// To hook up a portal later, replace the body, for example:
//   return new Promise((resolve) => PortalSDK.showRewardedAd({ onFinish: () => resolve(true), onSkip: () => resolve(false) }));
export const ADS_ENABLED = false;

export async function showRewardedAd() {
  return true;
}
