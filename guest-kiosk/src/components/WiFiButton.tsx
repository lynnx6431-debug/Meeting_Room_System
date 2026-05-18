type WiFiButtonProps = {
  ssid?: string | null;
};

export function WiFiButton({ ssid }: WiFiButtonProps) {
  return (
    <button
      type="button"
      disabled
      className="inline-flex items-center justify-center rounded-full border border-foreground/10 px-4 py-2 text-sm font-medium text-foreground/60"
      title={ssid ? `WiFi: ${ssid}` : 'WiFi details will be implemented in E3-08'}
    >
      WiFi (E3-08 placeholder)
    </button>
  );
}
