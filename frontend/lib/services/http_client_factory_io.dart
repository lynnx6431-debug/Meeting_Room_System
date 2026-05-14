import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http/io_client.dart';

http.Client createPlatformHttpClient({
  required bool trustSelfSigned,
  required Set<String> allowedBadCertHosts,
}) {
  if (!trustSelfSigned) {
    return http.Client();
  }

  final httpClient = HttpClient();
  httpClient.badCertificateCallback = (X509Certificate cert, String host, int port) {
    return allowedBadCertHosts.contains(host);
  };

  return IOClient(httpClient);
}
