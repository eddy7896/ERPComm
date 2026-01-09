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
      parentId: json['parent_id'] as String?,
      isPinned: json['is_pinned'] as bool? ?? false,
      payload: json['payload'] as Map<String, dynamic>?,
      topic: json['topic'] as String?,
      extension: json['extension'] as String?,
      event: json['event'] as String?,
      private: json['private'] as bool? ?? false,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
      sender: json['sender'] == null
          ? null
          : Profile.fromJson(json['sender'] as Map<String, dynamic>),
      reactions: (json['message_reactions'] as List<dynamic>?)
          ?.map((e) => Reaction.fromJson(e as Map<String, dynamic>))
          .toList(),
      parentMessage: json['parent_message'] as Map<String, dynamic>?,
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
      'parent_id': instance.parentId,
      'is_pinned': instance.isPinned,
      'payload': instance.payload,
      'topic': instance.topic,
      'extension': instance.extension,
      'event': instance.event,
      'private': instance.private,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt.toIso8601String(),
      'sender': instance.sender,
      'message_reactions': instance.reactions,
      'parent_message': instance.parentMessage,
    };
