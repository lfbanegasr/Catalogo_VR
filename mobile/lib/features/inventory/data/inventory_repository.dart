import 'dart:io';
import 'package:dio/dio.dart';
import 'package:http_parser/http_parser.dart';
import 'package:path/path.dart' as p;
import '../../../core/storage/secure_storage.dart';

class InventoryRepository {
  final Dio _dio;
  final SecureStorageService _storageService;
  
  static const String _baseUrl = 'http://10.0.2.2:8000/api';

  InventoryRepository(this._dio, this._storageService);

  // 1. Crear producto base en FastAPI
  Future<String> createProduct({
    required String nombre,
    required String descripcion,
    required double precioVenta,
    required int stockActual,
    String? idCategoria,
  }) async {
    final token = await _storageService.getToken();
    
    final response = await _dio.post(
      '$_baseUrl/catalog/products',
      data: {
        'nombre': nombre,
        'descripcion': descripcion,
        'precio_venta': precioVenta,
        'stock_actual': stockActual,
        'id_categoria': idCategoria,
      },
      options: Options(
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      ),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      // Retorna el ID del producto creado
      return response.data['id_producto'] as String;
    }
    throw Exception('Error al registrar el producto');
  }

  // 2. Subir imagen del producto recién creado
  Future<void> uploadProductImage(String productId, File imageFile) async {
    final token = await _storageService.getToken();
    final fileName = p.basename(imageFile.path);
    final ext = p.extension(imageFile.path).replaceAll('.', '');

    // Formulario multipart
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(
        imageFile.path,
        filename: fileName,
        contentType: MediaType('image', ext.isEmpty ? 'jpeg' : ext),
      ),
    });

    final response = await _dio.post(
      '$_baseUrl/catalog/products/$productId/image',
      data: formData,
      options: Options(
        headers: {
          'Authorization': 'Bearer $token',
        },
      ),
    );

    if (response.statusCode != 200) {
      throw Exception('Fallo al subir la imagen del producto');
    }
  }
}
