import 'package:http/http.dart' as http;

http.Client createPlatformHttpClient({
  required bool trustSelfSigned,
  required Set<String> allowedBadCertHosts,
}) {
  return http.Client();
}
