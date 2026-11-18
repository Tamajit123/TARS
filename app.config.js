// Maps SDK keys are platform-restricted build credentials. The server Routes /
// Places key is a separate Edge secret and is never read into this configuration.
module.exports = ({config}) => {
  const iosKey=process.env.GOOGLE_MAPS_IOS_SDK_KEY;
  const androidKey=process.env.GOOGLE_MAPS_ANDROID_SDK_KEY;
  return {
    ...config,
    ...(process.env.TARS_DEV_WEB_SPA==='1'?{web:{...config.web,output:'single'}}:{}),
    plugins:[...(config.plugins||[]).filter(plugin=>!['react-native-maps','@maplibre/maplibre-react-native'].includes(Array.isArray(plugin)?plugin[0]:plugin)),'@maplibre/maplibre-react-native',['react-native-maps',{
      ...(iosKey?{iosGoogleMapsApiKey:iosKey}:{}),...(androidKey?{androidGoogleMapsApiKey:androidKey}:{}),
    }]],
    extra:{...config.extra,googleMapsNativeConfigured:{ios:Boolean(iosKey),android:Boolean(androidKey)}},
  };
};
