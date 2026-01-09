import 'package:flutter/material.dart';
import 'package:ERPComm/models/profile.dart';

class MentionsList extends StatelessWidget {
  final List<Profile> members;
  final String query;
  final Function(Profile) onSelected;

  const MentionsList({
    super.key,
    required this.members,
    required this.query,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    final filtered = members.where((m) {
      final name = (m.fullName ?? m.username ?? '').toLowerCase();
      return name.contains(query.toLowerCase());
    }).toList();

    if (filtered.isEmpty) return const SizedBox.shrink();

    return Container(
      constraints: const BoxConstraints(maxHeight: 200),
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 4, offset: const Offset(0, -2)),
        ],
        border: Border.all(color: Colors.grey[300]!),
      ),
      child: ListView.builder(
        shrinkWrap: true,
        itemCount: filtered.length,
        itemBuilder: (context, index) {
          final profile = filtered[index];
          return ListTile(
            dense: true,
            leading: CircleAvatar(
              radius: 12,
              backgroundImage: profile.avatarUrl != null ? NetworkImage(profile.avatarUrl!) : null,
              child: profile.avatarUrl == null ? Text(profile.fullName?[0] ?? profile.username?[0] ?? '?', style: const TextStyle(fontSize: 10)) : null,
            ),
            title: Text(profile.fullName ?? profile.username ?? 'User', style: const TextStyle(fontSize: 13)),
            onTap: () => onSelected(profile),
          );
        },
      ),
    );
  }
}
