import 'package:json_annotation/json_annotation.dart';

part 'channel.g.dart';

@JsonSerializable()
class Channel {
  final String id;
  @JsonKey(name: 'workspace_id')
  final String workspaceId;
  final String name;
  final String? description;
  @JsonKey(name: 'is_private')
  final bool isPrivate;
  @JsonKey(name: 'encryption_enabled')
  final bool encryptionEnabled;
  @JsonKey(name: 'created_by')
  final String? createdBy;
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  Channel({
    required this.id,
    required this.workspaceId,
    required this.name,
    this.description,
    this.isPrivate = false,
    this.encryptionEnabled = false,
    this.createdBy,
    required this.createdAt,
  });

  factory Channel.fromJson(Map<String, dynamic> json) => _$ChannelFromJson(json);
  Map<String, dynamic> toJson() => _$ChannelToJson(this);
}
