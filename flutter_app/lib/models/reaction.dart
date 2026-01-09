import 'package:json_annotation/json_annotation.dart';

part 'reaction.g.dart';

@JsonSerializable()
class Reaction {
  final String id;
  @JsonKey(name: 'message_id')
  final String messageId;
  @JsonKey(name: 'user_id')
  final String userId;
  final String emoji;
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  Reaction({
    required this.id,
    required this.messageId,
    required this.userId,
    required this.emoji,
    required this.createdAt,
  });

  factory Reaction.fromJson(Map<String, dynamic> json) => _$ReactionFromJson(json);
  Map<String, dynamic> toJson() => _$ReactionToJson(this);
}
