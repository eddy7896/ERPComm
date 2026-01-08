// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'profile.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Profile _$ProfileFromJson(Map<String, dynamic> json) => Profile(
      id: json['id'] as String,
      fullName: json['full_name'] as String?,
      username: json['username'] as String?,
      avatarUrl: json['avatar_url'] as String?,
      statusText: json['status_text'] as String?,
      statusEmoji: json['status_emoji'] as String?,
      badge: json['badge'] as String?,
    );

Map<String, dynamic> _$ProfileToJson(Profile instance) => <String, dynamic>{
      'id': instance.id,
      'full_name': instance.fullName,
      'username': instance.username,
      'avatar_url': instance.avatarUrl,
      'status_text': instance.statusText,
      'status_emoji': instance.statusEmoji,
      'badge': instance.badge,
    };
