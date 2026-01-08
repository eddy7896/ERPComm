// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'message.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Message _$MessageFromJson(Map<String, dynamic> json) => Message(
      id: json['id'] as String,
      workspaceId: json['workspace_id'] as String,
      channelId: json['channel_id'] as String?,
      recipientId: json['recipient_id'] as String?,
      senderId: json['sender_id'] as String,
      content: json['content'] as String,
      isEdited: json['is_edited'] as bool? ?? false,
      isEncrypted: json['is_encrypted'] as bool? ?? false,
      payload: json['payload'] as Map<String, dynamic>?,
      topic: json['topic'] as String?,
      extension: json['extension'] as String?,
      event: json['event'] as String?,
      private: json['private'] as bool? ?? false,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
    );

Map<String, dynamic> _$MessageToJson(Message instance) => <String, dynamic>{
      'id': instance.id,
      'workspace_id': instance.workspaceId,
      'channel_id': instance.channelId,
      'recipient_id': instance.recipientId,
      'sender_id': instance.senderId,
      'content': instance.content,
      'is_edited': instance.isEdited,
      'is_encrypted': instance.isEncrypted,
      'payload': instance.payload,
      'topic': instance.topic,
      'extension': instance.extension,
      'event': instance.event,
      'private': instance.private,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt.toIso8601String(),
    };
