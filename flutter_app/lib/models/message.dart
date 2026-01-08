import 'package:json_annotation/json_annotation.dart';

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
  final Map<String, dynamic>? payload;
  final String? topic;
  final String? extension;
  final String? event;
  final bool private;
  @JsonKey(name: 'created_at')
  final DateTime createdAt;
  @JsonKey(name: 'updated_at')
  final DateTime updatedAt;

  Message({
    required this.id,
    required this.workspaceId,
    this.channelId,
    this.recipientId,
    required this.senderId,
    required this.content,
    this.isEdited = false,
    this.isEncrypted = false,
    this.payload,
    this.topic,
    this.extension,
    this.event,
    this.private = false,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Message.fromJson(Map<String, dynamic> json) => _$MessageFromJson(json);
  Map<String, dynamic> toJson() => _$MessageToJson(this);
}
