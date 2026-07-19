import 'package:dio/dio.dart';
import '../../../core/storage/secure_storage.dart';

class AuthRepository {
  final Dio _dio;
  final SecureStorageService _storageService;

  // Cambiar por tu IP local de la computadora si pruebas en teléfono físico (ej: http://192.168.1.50:8000/api)
  static const String _baseUrl = 'http://10.0.2.2:8000/api'; // IP por defecto para emulador Android

  AuthRepository(this._dio, this._storageService);

  Future<bool> login(String email, String password) async {
    try {
      final response = await _dio.post(
        '$_baseUrl/auth/login-json',
        data: {
          'email': email,
          'password': password,
        },
        options: Options(
          headers: {'Content-Type': 'application/json'},
        ),
      );

      if (response.statusCode == 200) {
        final token = response.data['access_token'] as String;
        // Guardar de forma segura en el dispositivo
        await _storageService.saveToken(token);
        return true;
      }
      return false;
    } on DioException catch (e) {
      final errorMsg = e.response?.data['detail'] ?? 'Error desconocido de autenticación';
      throw Exception(errorMsg);
    }
  }
}
