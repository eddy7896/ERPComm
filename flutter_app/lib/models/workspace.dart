import 'package:json_annotation/json_annotation.dart';

part 'workspace.g.dart';

@JsonSerializable()
class Workspace {
  final String id;
  final String name;
  final String slug;
  @JsonKey(name: 'owner_id')
  final String ownerId;
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  Workspace({
    required this.id,
    required this.name,
    required this.slug,
    required this.ownerId,
    required this.createdAt,
  });

  factory Workspace.fromJson(Map<String, dynamic> json) => _$WorkspaceFromJson(json);
  Map<String, dynamic> toJson() => _$WorkspaceToJson(this);
}
