export async function commitAvatar(path: string, gateway: {
  upload: () => Promise<void>;
  signedUrl: () => Promise<string>;
  updateProfile: () => Promise<void>;
  referenced: () => Promise<boolean>;
  remove: () => Promise<void>;
}) {
  try {
    await gateway.upload();
    const signedUrl = await gateway.signedUrl();
    await gateway.updateProfile();
    return { path, signedUrl };
  } catch (error) {
    // A failed network response can have an uncertain write outcome. Only
    // remove our new object after confirming the profile does not reference it.
    try { if (!await gateway.referenced()) await gateway.remove(); } catch { /* Preserve an object if its reference cannot be confirmed. */ }
    throw error;
  }
}
