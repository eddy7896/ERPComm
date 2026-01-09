import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class StatusPicker extends StatefulWidget {
  final String? currentText;
  final String? currentEmoji;
  final Function(String?, String?) onSave;

  const StatusPicker({
    super.key,
    this.currentText,
    this.currentEmoji,
    required this.onSave,
  });

  @override
  State<StatusPicker> createState() => _StatusPickerState();
}

class _StatusPickerState extends State<StatusPicker> {
  late TextEditingController _textController;
  String? _selectedEmoji;
  final List<String> _commonEmojis = ['💬', '📅', '🤒', '🏠', '🌴', '🎯', '⌛', '✅'];

  @override
  void initState() {
    super.initState();
    _textController = TextEditingController(text: widget.currentText);
    _selectedEmoji = widget.currentEmoji;
  }

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Set a status',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              GestureDetector(
                onTap: () {
                  // In a real app, show an emoji picker
                },
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.grey[300]!),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(_selectedEmoji ?? '😀', style: const TextStyle(fontSize: 20)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _textController,
                  decoration: const InputDecoration(
                    hintText: "What's your status?",
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Text('Common statuses', style: TextStyle(fontSize: 14, color: Colors.grey)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: _commonEmojis.map((e) => ActionChip(
              label: Text(e),
              onPressed: () => setState(() => _selectedEmoji = e),
              backgroundColor: _selectedEmoji == e ? Colors.grey[200] : Colors.white,
            )).toList(),
          ),
          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel'),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                onPressed: () {
                  widget.onSave(_textController.text, _selectedEmoji);
                  Navigator.pop(context);
                },
                child: const Text('Save'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
