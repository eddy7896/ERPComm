import 'package:dio/dio.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class ApiService {
  final Dio _dio = Dio();
  final String _baseUrl = 'https://rysxvlpvrqhxoqjnigoo.supabase.co/rest/v1';
  final String _anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5c3h2bHB2cnFoeG9xam5pZ29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MDA2MzksImV4cCI6MjA4MzQ3NjYzOX0.fvehQRdRhOssrbqPuLVUJ4C81zPWXRxgWnZ7ewPOxio';

  ApiService() {
    _dio.options.baseUrl = _baseUrl;
    _dio.options.headers = {
      'apikey': _anonKey,
      'Authorization': 'Bearer ${Supabase.instance.client.auth.currentSession?.accessToken ?? _anonKey}',
      'Content-Type': 'application/json',
    };
  }

  Future<Response> get(String path, {Map<String, dynamic>? queryParameters}) async {
    try {
      return await _dio.get(path, queryParameters: queryParameters);
    } on DioException catch (e) {
      rethrow;
    }
  }

  Future<Response> post(String path, {dynamic data}) async {
    try {
      return await _dio.post(path, data: data);
    } on DioException catch (e) {
      rethrow;
    }
  }
}
