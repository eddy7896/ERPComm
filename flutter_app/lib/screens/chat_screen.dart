import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_app/models/channel.dart';
import 'package:flutter_app/models/profile.dart';
import 'package:flutter_app/models/message.dart';
import 'package:flutter_app/models/reaction.dart';
import 'package:intl/intl.dart';
import 'package:file_picker/file_picker.dart';
import 'package:path/path.dart' as p;
import 'package:audioplayers/audioplayers.dart';

import 'package:flutter_app/screens/search_screen.dart';

class ChatScreen extends StatefulWidget {
  final Channel? channel;
  final Profile? recipient;
  
  const ChatScreen({
    super.key,
    this.channel,
    this.recipient,
  }) : assert(channel != null || recipient != null);

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _supabase = Supabase.instance.client;
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  List<Message> _messages = [];
  bool _isLoading = true;
  RealtimeChannel? _realtimeChannel;
  Message? _replyingTo;
  List<Map<String, dynamic>> _attachedFiles = [];
  bool _isUploading = false;
  List<Profile> _typingUsers = [];
  final _audioPlayer = AudioPlayer();

  @override
  void initState() {
    super.initState();
    _fetchMessages();
    _subscribeToMessages();
    _setupPresence();
  }

  @override
  void didUpdateWidget(ChatScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.channel?.id != widget.channel?.id || oldWidget.recipient?.id != widget.recipient?.id) {
      _realtimeChannel?.unsubscribe();
      setState(() {
        _replyingTo = null;
        _messages = [];
        _attachedFiles = [];
        _typingUsers = [];
      });
      _fetchMessages();
      _subscribeToMessages();
      _setupPresence();
    }
  }

  @override
  void dispose() {
    _realtimeChannel?.unsubscribe();
    _messageController.dispose();
    _scrollController.dispose();
    _audioPlayer.dispose();
    super.dispose();
  }

  void _setupPresence() {
    final roomId = widget.channel?.id ?? widget.recipient?.id;
    final presenceChannel = _supabase.channel('presence:$roomId');

    presenceChannel.onPresenceSync((payload) {
      final states = presenceChannel.presenceState();
      final List<Profile> typers = [];
      states.forEach((key, value) {
        for (var presence in value) {
          final p = presence.payload;
          if (p['is_typing'] == true && p['user_id'] != _supabase.auth.currentUser?.id) {
            // We'd ideally have full profile info here, but for now we'll just use the ID or name from payload
            typers.add(Profile(
              id: p['user_id'], 
              fullName: p['full_name'], 
              username: p['username']
            ));
          }
        }
      });
      if (mounted) setState(() => _typingUsers = typers);
    }).subscribe((status, error) async {
      if (status == RealtimeSubscribeStatus.subscribed) {
        await presenceChannel.track({
          'user_id': _supabase.auth.currentUser?.id,
          'is_typing': false,
          'full_name': 'User', // Should fetch actual profile info
        });
      }
    });
  }

  void _handleTyping(bool isTyping) {
    final roomId = widget.channel?.id ?? widget.recipient?.id;
    _supabase.channel('presence:$roomId').track({
      'user_id': _supabase.auth.currentUser?.id,
      'is_typing': isTyping,
      'full_name': 'User', 
    });
  }

  Future<void> _fetchMessages() async {
    setState(() => _isLoading = true);
    try {
      var query = _supabase.from('messages').select('*, sender:profiles!sender_id(*), message_reactions(*), parent_message:messages!parent_id(*, sender:profiles!sender_id(*))');

      if (widget.channel != null) {
        query = query.eq('channel_id', widget.channel!.id);
      } else {
        final myId = _supabase.auth.currentUser!.id;
        final recipientId = widget.recipient!.id;
        query = query.or('and(sender_id.eq.$myId,recipient_id.eq.$recipientId),and(sender_id.eq.$recipientId,recipient_id.eq.$myId)');
      }

      final response = await query.order('created_at', ascending: true);

      final List<dynamic> data = response as List<dynamic>;
      setState(() {
        _messages = data.map((item) => Message.fromJson(item)).toList();
        _isLoading = false;
      });
      _scrollToBottom();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error fetching messages: $e')),
        );
      }
      setState(() => _isLoading = false);
    }
  }

  void _subscribeToMessages() {
    final channelId = widget.channel?.id;
    final recipientId = widget.recipient?.id;
    final myId = _supabase.auth.currentUser?.id;

    String channelName = 'public:chat:${channelId ?? recipientId}';

    _realtimeChannel = _supabase.channel(channelName);

    _realtimeChannel!.onPostgresChanges(
      event: PostgresChangeEvent.all,
      schema: 'public',
      table: 'messages',
      callback: (payload) async {
        if (payload.eventType == PostgresChangeEvent.insert) {
          final newMessageData = payload.newRecord;
          
          if (channelId != null && newMessageData['channel_id'] != channelId) return;
            if (recipientId != null) {
              final senderId = newMessageData['sender_id'];
              final recId = newMessageData['recipient_id'];
              final isRelevant = (senderId == myId && recId == recipientId) || (senderId == recipientId && recId == myId);
              if (!isRelevant) return;

              // Play sound for incoming direct message
              if (recId == myId) {
                _audioPlayer.play(AssetSource('sounds/pop.mp3'));
              }
            }


          final senderResponse = await _supabase.from('profiles').select().eq('id', newMessageData['sender_id']).single();
          Map<String, dynamic>? parentMessage;
          if (newMessageData['parent_id'] != null) {
            parentMessage = await _supabase.from('messages').select('*, sender:profiles!sender_id(*)').eq('id', newMessageData['parent_id']).single();
          }

          final newMessage = Message.fromJson({
            ...newMessageData,
            'sender': senderResponse,
            'parent_message': parentMessage,
            'message_reactions': [],
          });

          if (mounted) {
            setState(() {
              _messages.add(newMessage);
            });
            _scrollToBottom();
          }
        } else if (payload.eventType == PostgresChangeEvent.update) {
          final updatedMessageData = payload.newRecord;
          if (mounted) {
            setState(() {
              final index = _messages.indexWhere((m) => m.id == updatedMessageData['id']);
              if (index != -1) {
                _messages[index] = Message.fromJson({
                  ..._messages[index].toJson(),
                  ...updatedMessageData,
                });
              }
            });
          }
        } else if (payload.eventType == PostgresChangeEvent.delete) {
          if (mounted) {
            setState(() {
              _messages.removeWhere((m) => m.id == payload.oldRecord['id']);
            });
          }
        }
      },
    ).onPostgresChanges(
      event: PostgresChangeEvent.all,
      schema: 'public',
      table: 'message_reactions',
      callback: (payload) {
        if (payload.eventType == PostgresChangeEvent.insert) {
          final newReaction = Reaction.fromJson(payload.newRecord);
          if (mounted) {
            setState(() {
              final index = _messages.indexWhere((m) => m.id == newReaction.messageId);
              if (index != -1) {
                final updatedMessage = _messages[index];
                final reactions = List<Reaction>.from(updatedMessage.reactions ?? []);
                reactions.add(newReaction);
                _messages[index] = Message.fromJson({
                  ...updatedMessage.toJson(),
                  'message_reactions': reactions.map((r) => r.toJson()).toList(),
                });
              }
            });
          }
        } else if (payload.eventType == PostgresChangeEvent.delete) {
          final oldReactionId = payload.oldRecord['id'];
          if (mounted) {
            setState(() {
              for (int i = 0; i < _messages.length; i++) {
                final reactions = _messages[i].reactions;
                if (reactions != null) {
                  final reactionIndex = reactions.indexWhere((r) => r.id == oldReactionId);
                  if (reactionIndex != -1) {
                    final updatedReactions = List<Reaction>.from(reactions);
                    updatedReactions.removeAt(reactionIndex);
                    _messages[i] = Message.fromJson({
                      ..._messages[i].toJson(),
                      'message_reactions': updatedReactions.map((r) => r.toJson()).toList(),
                    });
                    break;
                  }
                }
              }
            });
          }
        }
      },
    ).subscribe();
  }

  void _scrollToBottom() {
    Future.delayed(const Duration(milliseconds: 100), () {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _pickFiles() async {
    final result = await FilePicker.platform.pickFiles(allowMultiple: true);
    if (result == null) return;

    setState(() => _isUploading = true);
    try {
      for (final file in result.files) {
        final fileName = '${DateTime.now().millisecondsSinceEpoch}_${file.name}';
        final path = 'uploads/$fileName';
        
        if (kIsWeb) {
          await _supabase.storage.from('attachments').uploadBinary(path, file.bytes!);
        } else {
          await _supabase.storage.from('attachments').upload(path, File(file.path!));
        }

        final url = _supabase.storage.from('attachments').getPublicUrl(path);
        
        setState(() {
          _attachedFiles.add({
            'name': file.name,
            'url': url,
            'size': file.size,
            'type': _getFileType(file.name),
          });
        });
      }
    } catch (e) {
      debugPrint('Error uploading file: $e');
    } finally {
      setState(() => _isUploading = false);
    }
  }

  String _getFileType(String fileName) {
    final ext = p.extension(fileName).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].contains(ext)) return 'image/$ext';
    return 'application/octet-stream';
  }

  Future<void> _sendMessage() async {
    final content = _messageController.text.trim();
    if (content.isEmpty && _attachedFiles.isEmpty) return;

    final parentId = _replyingTo?.id;
    final payload = _attachedFiles.isNotEmpty ? {'files': _attachedFiles} : null;
    
    _messageController.clear();
    setState(() {
      _replyingTo = null;
      _attachedFiles = [];
    });
    _handleTyping(false);

    try {
      final userId = _supabase.auth.currentUser?.id;
      if (userId == null) return;

      final Map<String, dynamic> messageData = {
        'workspace_id': widget.channel?.workspaceId ?? widget.recipient?.id, 
        'sender_id': userId,
        'content': content,
        'parent_id': parentId,
        'payload': payload,
      };

      if (widget.channel != null) {
        messageData['channel_id'] = widget.channel!.id;
        messageData['workspace_id'] = widget.channel!.workspaceId;
      } else {
        messageData['recipient_id'] = widget.recipient!.id;
      }

      await _supabase.from('messages').insert(messageData);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error sending message: $e')),
        );
      }
    }
  }

  Future<void> _toggleReaction(String messageId, String emoji) async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return;

    final existingReaction = _messages
        .firstWhere((m) => m.id == messageId)
        .reactions
        ?.firstWhere((r) => r.userId == userId && r.emoji == emoji, orElse: () => Reaction(id: '', messageId: '', userId: '', emoji: '', createdAt: DateTime.now()));

    try {
      if (existingReaction != null && existingReaction.id.isNotEmpty) {
        await _supabase.from('message_reactions').delete().eq('id', existingReaction.id);
      } else {
        await _supabase.from('message_reactions').insert({
          'message_id': messageId,
          'user_id': userId,
          'emoji': emoji,
        });
      }
    } catch (e) {
      debugPrint('Error toggling reaction: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final isMobile = MediaQuery.of(context).size.width < 768;
    final title = widget.channel != null 
        ? '# ${widget.channel!.name}' 
        : (widget.recipient!.fullName ?? widget.recipient!.username ?? 'Chat');

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: !isMobile ? null : AppBar(
        title: Text(title),
      ),
      body: Column(
        children: [
          if (!isMobile)
            _buildDesktopHeader(title),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    itemCount: _messages.length,
                    itemBuilder: (context, index) {
                      final message = _messages[index];
                      return _MessageBubble(
                        message: message, 
                        onReply: (msg) => setState(() => _replyingTo = msg),
                        onReact: (emoji) => _toggleReaction(message.id, emoji),
                        currentUserId: _supabase.auth.currentUser?.id ?? '',
                      );
                    },
                  ),
          ),
          if (_typingUsers.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: Row(
                children: [
                  const SizedBox(
                    width: 12,
                    height: 12,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.grey),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '${_typingUsers.map((u) => u.fullName ?? u.username).join(", ")} is typing...',
                    style: const TextStyle(fontSize: 12, color: Colors.grey, italic: true),
                  ),
                ],
              ),
            ),
          _ChatInput(
            controller: _messageController, 
            onSend: _sendMessage,
            onPickFiles: _pickFiles,
            onTyping: _handleTyping,
            replyingTo: _replyingTo,
            attachedFiles: _attachedFiles,
            isUploading: _isUploading,
            onCancelReply: () => setState(() => _replyingTo = null),
            onRemoveFile: (index) => setState(() => _attachedFiles.removeAt(index)),
          ),
        ],
      ),
    );
  }

  Widget _buildDesktopHeader(String title) {
    return Container(
      height: 64,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Colors.grey[200]!)),
      ),
      child: Row(
        children: [
          Icon(widget.channel != null ? Icons.tag : Icons.person_outline, color: Colors.grey[600]),
          const SizedBox(width: 8),
          Text(
            title,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const Spacer(),
          IconButton(
            icon: const Icon(Icons.search), 
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (context) => SearchScreen(workspaceId: widget.channel?.workspaceId ?? widget.recipient?.id ?? ''),
                ),
              );
            },
          ),
          IconButton(icon: const Icon(Icons.info_outline), onPressed: () {}),
        ],
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final Message message;
  final Function(Message) onReply;
  final Function(String) onReact;
  final String currentUserId;

  const _MessageBubble({
    required this.message, 
    required this.onReply,
    required this.onReact,
    required this.currentUserId,
  });

  @override
  Widget build(BuildContext context) {
    final sender = message.sender;
    final parent = message.parentMessage;
    final files = message.payload?['files'] as List<dynamic>?;
    
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: Colors.grey[200],
              backgroundImage: sender?.avatarUrl != null ? NetworkImage(sender!.avatarUrl!) : null,
              child: sender?.avatarUrl == null 
                  ? Text(sender?.fullName?[0] ?? sender?.username?[0] ?? '?', style: const TextStyle(fontSize: 12, color: Colors.black87)) 
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        sender?.fullName ?? sender?.username ?? 'Unknown',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        DateFormat('h:mm a').format(message.createdAt),
                        style: TextStyle(fontSize: 11, color: Colors.grey[500]),
                      ),
                      const Spacer(),
                      _buildActions(context),
                    ],
                  ),
                  if (parent != null)
                    _buildParentMessage(parent),
                  const SizedBox(height: 4),
                  if (message.content.isNotEmpty)
                    Text(
                      message.content,
                      style: const TextStyle(fontSize: 15, height: 1.4, color: Colors.black87),
                    ),
                  if (files != null)
                    _buildFiles(files),
                  if (message.reactions != null && message.reactions!.isNotEmpty)
                    _buildReactions(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFiles(List<dynamic> files) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: files.map((file) {
          final isImage = (file['type'] as String).startsWith('image/');
          if (isImage) {
            return ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.network(
                file['url'],
                width: 200,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => const Icon(Icons.broken_image),
              ),
            );
          }
          return Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.grey[100],
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.grey[300]!),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.insert_drive_file, size: 20, color: Colors.grey),
                const SizedBox(width: 8),
                Text(
                  file['name'],
                  style: const TextStyle(fontSize: 12),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildReactions() {
    final Map<String, List<Reaction>> grouped = {};
    for (var r in message.reactions!) {
      grouped.putIfAbsent(r.emoji, () => []).add(r);
    }

    return Wrap(
      spacing: 4,
      runSpacing: 4,
      children: grouped.entries.map((entry) {
        final hasReacted = entry.value.any((r) => r.userId == currentUserId);
        return GestureDetector(
          onTap: () => onReact(entry.key),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: hasReacted ? const Color(0xFFE8F5E9) : Colors.grey[100],
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: hasReacted ? Colors.green : Colors.transparent),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(entry.key, style: const TextStyle(fontSize: 12)),
                const SizedBox(width: 4),
                Text('${entry.value.length}', style: TextStyle(fontSize: 10, color: hasReacted ? Colors.green[700] : Colors.grey[700])),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildParentMessage(Map<String, dynamic> parent) {
    final parentSender = parent['sender'] != null ? Profile.fromJson(parent['sender']) : null;
    return Container(
      margin: const EdgeInsets.only(top: 4, bottom: 4),
      padding: const EdgeInsets.only(left: 8),
      decoration: const BoxDecoration(
        border: Border(left: BorderSide(color: Colors.grey, width: 2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.reply, size: 12, color: Colors.grey),
              const SizedBox(width: 4),
              Text(
                parentSender?.fullName ?? parentSender?.username ?? 'User',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey),
              ),
            ],
          ),
          Text(
            parent['content'] ?? '',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 12, color: Colors.grey, fontStyle: FontStyle.italic),
          ),
        ],
      ),
    );
  }

  Widget _buildActions(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          icon: const Icon(Icons.reply, size: 16, color: Colors.grey),
          onPressed: () => onReply(message),
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(),
          visualDensity: VisualDensity.compact,
          tooltip: 'Reply',
        ),
        const SizedBox(width: 8),
        IconButton(
          icon: const Icon(Icons.emoji_emotions_outlined, size: 16, color: Colors.grey),
          onPressed: () => _showEmojiPicker(context),
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(),
          visualDensity: VisualDensity.compact,
          tooltip: 'React',
        ),
      ],
    );
  }

  void _showEmojiPicker(BuildContext context) {
    final emojis = ['👍', '❤️', '😂', '😮', '😢', '🔥', '✅', '🚀'];
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        contentPadding: const EdgeInsets.all(16),
        content: Wrap(
          spacing: 12,
          runSpacing: 12,
          children: emojis.map((e) => GestureDetector(
            onTap: () {
              onReact(e);
              Navigator.pop(context);
            },
            child: Text(e, style: const TextStyle(fontSize: 24)),
          )).toList(),
        ),
      ),
    );
  }
}

class _ChatInput extends StatelessWidget {
  final TextEditingController controller;
  final VoidCallback onSend;
  final VoidCallback onPickFiles;
  final Function(bool) onTyping;
  final Message? replyingTo;
  final List<Map<String, dynamic>> attachedFiles;
  final bool isUploading;
  final VoidCallback onCancelReply;
  final Function(int) onRemoveFile;

  const _ChatInput({
    required this.controller, 
    required this.onSend, 
    required this.onPickFiles,
    required this.onTyping,
    this.replyingTo,
    required this.attachedFiles,
    required this.isUploading,
    required this.onCancelReply,
    required this.onRemoveFile,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Colors.grey[200]!)),
      ),
      child: SafeArea(
        child: Column(
          children: [
            if (replyingTo != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                margin: const EdgeInsets.only(bottom: 8),
                decoration: BoxDecoration(
                  color: Colors.grey[100],
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.reply, size: 16, color: Colors.grey),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Replying to ${replyingTo!.sender?.fullName ?? replyingTo!.sender?.username ?? 'User'}',
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                          ),
                          Text(
                            replyingTo!.content,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 11, color: Colors.grey),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, size: 16),
                      onPressed: onCancelReply,
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                    ),
                  ],
                ),
              ),
            if (attachedFiles.isNotEmpty)
              SizedBox(
                height: 60,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  itemCount: attachedFiles.length,
                  itemBuilder: (context, index) {
                    final file = attachedFiles[index];
                    return Container(
                      width: 150,
                      margin: const EdgeInsets.only(right: 8, bottom: 8),
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.grey[50],
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.grey[300]!),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.insert_drive_file, size: 16),
                          const SizedBox(width: 4),
                          Expanded(child: Text(file['name'], maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 10))),
                          IconButton(
                            icon: const Icon(Icons.close, size: 12),
                            onPressed: () => onRemoveFile(index),
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            Container(
              decoration: BoxDecoration(
                border: Border.all(color: Colors.grey[300]!),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                children: [
                  TextField(
                    controller: controller,
                    maxLines: null,
                    decoration: const InputDecoration(
                      hintText: 'Message...',
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    ),
                    onChanged: (val) => onTyping(val.isNotEmpty),
                    onSubmitted: (_) => onSend(),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.grey[50],
                      borderRadius: const BorderRadius.only(
                        bottomLeft: Radius.circular(7),
                        bottomRight: Radius.circular(7),
                      ),
                    ),
                    child: Row(
                      children: [
                        IconButton(icon: const Icon(Icons.alternate_email, size: 20), onPressed: () {}),
                        IconButton(icon: const Icon(Icons.sentiment_satisfied_alt, size: 20), onPressed: () {}),
                        IconButton(
                          icon: isUploading 
                              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                              : const Icon(Icons.attach_file, size: 20), 
                          onPressed: isUploading ? null : onPickFiles,
                        ),
                        const Spacer(),
                        ElevatedButton(
                          onPressed: isUploading ? null : onSend,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF007a5a),
                            foregroundColor: Colors.white,
                            minimumSize: const Size(32, 32),
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                          ),
                          child: const Icon(Icons.send, size: 18),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
