import 'package:json_annotation/json_annotation.dart';
import 'profile.dart';
import 'reaction.dart';

part 'message.g.dart';

@JsonSerializable()
class Message {
  final String id;
  @JsonKey(name: 'workspace_id')
  final String workspaceId;
  @JsonKey(name: 'channel_id')
  final String? channelId;
  @JsonKey(name: 'recipient_id')
  final String? recipientId;
  @JsonKey(name: 'sender_id')
  final String senderId;
  final String content;
  @JsonKey(name: 'is_edited')
  final bool isEdited;
  @JsonKey(name: 'is_encrypted')
  final bool isEncrypted;
  @JsonKey(name: 'parent_id')
  final String? parentId;
  @JsonKey(name: 'is_pinned')
  final bool isPinned;
  final Map<String, dynamic>? payload;
  final String? topic;
  final String? extension;
  final String? event;
  final bool private;
  @JsonKey(name: 'created_at')
  final DateTime createdAt;
  @JsonKey(name: 'updated_at')
  final DateTime updatedAt;

  // Joined fields
  final Profile? sender;
  @JsonKey(name: 'message_reactions')
  final List<Reaction>? reactions;
  @JsonKey(name: 'parent_message')
  final Map<String, dynamic>? parentMessage;

  Message({
    required this.id,
    required this.workspaceId,
    this.channelId,
    this.recipientId,
    required this.senderId,
    required this.content,
    this.isEdited = false,
    this.isEncrypted = false,
    this.parentId,
    this.isPinned = false,
    this.payload,
    this.topic,
    this.extension,
    this.event,
    this.private = false,
    required this.createdAt,
    required this.updatedAt,
    this.sender,
    this.reactions,
    this.parentMessage,
  });

  factory Message.fromJson(Map<String, dynamic> json) => _$MessageFromJson(json);
  Map<String, dynamic> toJson() => _$MessageToJson(this);
}
