import 'package:json_annotation/json_annotation.dart';

part 'profile.g.dart';

@JsonSerializable()
class Profile {
  final String id;
  @JsonKey(name: 'full_name')
  final String? fullName;
  final String? username;
  @JsonKey(name: 'avatar_url')
  final String? avatarUrl;
  @JsonKey(name: 'status_text')
  final String? statusText;
  @JsonKey(name: 'status_emoji')
  final String? statusEmoji;
  final String? badge;

  Profile({
    required this.id,
    this.fullName,
    this.username,
    this.avatarUrl,
    this.statusText,
    this.statusEmoji,
    this.badge,
  });

  factory Profile.fromJson(Map<String, dynamic> json) => _$ProfileFromJson(json);
  Map<String, dynamic> toJson() => _$ProfileToJson(this);
}
