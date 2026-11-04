import { toUnicode } from "punycode/";
export function displayAddress(address: string): string {
  return address.replace(
    /^(https?:\/\/)([^/:?#]+)/i,
    (_, scheme: string, host: string) => scheme + toUnicode(host),
  );
}
