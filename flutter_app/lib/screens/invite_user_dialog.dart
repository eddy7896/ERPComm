import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class InviteUserDialog extends StatefulWidget {
  final String workspaceId;
  final String workspaceSlug;

  const InviteUserDialog({super.key, required this.workspaceId, required this.workspaceSlug});

  @override
  State<InviteUserDialog> createState() => _InviteUserDialogState();
}

class _InviteUserDialogState extends State<InviteUserDialog> {
  final _emailController = TextEditingController();
  bool _isLoading = false;
  String? _inviteLink;

  @override
  void initState() {
    super.initState();
    _inviteLink = 'https://enterprisechat.com/invite/${widget.workspaceSlug}';
  }

  Future<void> _sendInvite() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) return;

    setState(() => _isLoading = true);
    try {
      // In a real app, this would call an API to send an email
      // For now, we'll just simulate it
      await Future.delayed(const Duration(seconds: 1));
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Invitation sent successfully!')),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      debugPrint('Error sending invite: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Invite people'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Send an invite link to someone', style: TextStyle(fontSize: 14, color: Colors.grey)),
          const SizedBox(height: 16),
          TextField(
            controller: _emailController,
            decoration: const InputDecoration(
              labelText: 'Email address',
              hintText: 'name@example.com',
            ),
          ),
          const SizedBox(height: 24),
          const Text('Or share this link', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.grey[100],
              borderRadius: BorderRadius.circular(4),
              border: Border.all(color: Colors.grey[300]!),
            ),
            child: Row(
              children: [
                Expanded(child: Text(_inviteLink!, style: const TextStyle(fontSize: 12), overflow: TextOverflow.ellipsis)),
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(Icons.copy, size: 16),
                  onPressed: () {
                    // Copy to clipboard
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Link copied to clipboard')));
                  },
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              ],
            ),
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        ElevatedButton(
          onPressed: _isLoading ? null : _sendInvite,
          child: _isLoading ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Send'),
        ),
      ],
    );
  }
}
