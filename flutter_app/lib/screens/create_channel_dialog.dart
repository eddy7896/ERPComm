import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class CreateChannelDialog extends StatefulWidget {
  final String workspaceId;
  final VoidCallback onCreated;

  const CreateChannelDialog({super.key, required this.workspaceId, required this.onCreated});

  @override
  State<CreateChannelDialog> createState() => _CreateChannelDialogState();
}

class _CreateChannelDialogState extends State<CreateChannelDialog> {
  final _nameController = TextEditingController();
  final _descController = TextEditingController();
  bool _isLoading = false;

  Future<void> _createChannel() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) return;

    setState(() => _isLoading = true);
    try {
      await Supabase.instance.client.from('channels').insert({
        'workspace_id': widget.workspaceId,
        'name': name,
        'description': _descController.text.trim(),
        'created_by': Supabase.instance.client.auth.currentUser!.id,
      });

      widget.onCreated();
      if (mounted) Navigator.pop(context);
    } catch (e) {
      debugPrint('Error creating channel: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Create a channel'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _nameController,
            decoration: const InputDecoration(
              labelText: 'Name',
              hintText: 'e.g. budget-planning',
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _descController,
            decoration: const InputDecoration(
              labelText: 'Description (optional)',
            ),
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        ElevatedButton(
          onPressed: _isLoading ? null : _createChannel,
          child: _isLoading ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Create'),
        ),
      ],
    );
  }
}
