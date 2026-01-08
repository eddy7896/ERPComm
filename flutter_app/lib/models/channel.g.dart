// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'channel.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Channel _$ChannelFromJson(Map<String, dynamic> json) => Channel(
      id: json['id'] as String,
      workspaceId: json['workspace_id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      isPrivate: json['is_private'] as bool? ?? false,
      encryptionEnabled: json['encryption_enabled'] as bool? ?? false,
      createdBy: json['created_by'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
    );

Map<String, dynamic> _$ChannelToJson(Channel instance) => <String, dynamic>{
      'id': instance.id,
      'workspace_id': instance.workspaceId,
      'name': instance.name,
      'description': instance.description,
      'is_private': instance.isPrivate,
      'encryption_enabled': instance.encryptionEnabled,
      'created_by': instance.createdBy,
      'created_at': instance.createdAt.toIso8601String(),
    };
