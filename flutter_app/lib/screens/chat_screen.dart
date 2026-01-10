import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:ERPComm/models/channel.dart';
import 'package:ERPComm/models/profile.dart';
import 'package:ERPComm/models/message.dart';
import 'package:ERPComm/models/reaction.dart';
import 'package:intl/intl.dart';
import 'package:file_picker/file_picker.dart';
import 'package:path/path.dart' as p;
import 'package:audioplayers/audioplayers.dart';

import 'package:ERPComm/screens/search_screen.dart';
import 'package:ERPComm/screens/mentions_list.dart';
import 'package:ERPComm/screens/giphy_picker.dart';
import 'package:ERPComm/screens/google_drive_picker.dart';
import 'package:ERPComm/services/google_drive_service.dart';
import 'package:ERPComm/theme/shad_theme.dart';
import 'package:ERPComm/widgets/shad_avatar.dart';
import 'package:ERPComm/widgets/shad_badge.dart';

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
  List<Profile> _workspaceMembers = [];
  String _mentionQuery = '';
  bool _showMentions = false;
  final _audioPlayer = AudioPlayer();

  @override
  void initState() {
    super.initState();
    _fetchMessages();
    _fetchWorkspaceMembers();
    _subscribeToMessages();
    _setupPresence();
    _messageController.addListener(_onTextChanged);
  }

  void _onTextChanged() {
    final text = _messageController.text;
    final selection = _messageController.selection;
    if (selection.baseOffset > 0) {
      final beforeCursor = text.substring(0, selection.baseOffset);
      final lastAt = beforeCursor.lastIndexOf('@');
      if (lastAt != -1 && (lastAt == 0 || beforeCursor[lastAt - 1] == ' ')) {
        final query = beforeCursor.substring(lastAt + 1);
        if (!query.contains(' ')) {
          setState(() {
            _showMentions = true;
            _mentionQuery = query;
          });
          return;
        }
      }
    }
    if (_showMentions) {
      setState(() => _showMentions = false);
    }
  }

  Future<void> _fetchWorkspaceMembers() async {
    try {
      final workspaceId = widget.channel?.workspaceId ?? widget.recipient?.id;
      if (workspaceId == null) return;

      final response = await _supabase
          .from('workspace_members')
          .select('profiles (*)')
          .eq('workspace_id', workspaceId);

      setState(() {
        _workspaceMembers = (response as List)
            .map((m) => Profile.fromJson(m['profiles']))
            .toList();
      });
    } catch (e) {
      debugPrint('Error fetching members: $e');
    }
  }

  void _onMentionSelected(Profile profile) {
    final text = _messageController.text;
    final selection = _messageController.selection;
    final beforeCursor = text.substring(0, selection.baseOffset);
    final afterCursor = text.substring(selection.baseOffset);
    final lastAt = beforeCursor.lastIndexOf('@');
    
    final newText = '${beforeCursor.substring(0, lastAt)}@${profile.username ?? profile.fullName ?? 'user'} $afterCursor';
    _messageController.text = newText;
    _messageController.selection = TextSelection.fromPosition(
      TextPosition(offset: lastAt + (profile.username ?? profile.fullName ?? 'user').length + 2)
    );
    setState(() => _showMentions = false);
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
      for (final state in states) {
        for (var presence in state.presences) {
          final p = presence.payload;
          if (p['is_typing'] == true && p['user_id'] != _supabase.auth.currentUser?.id) {
            typers.add(Profile(
              id: p['user_id'], 
              fullName: p['full_name'], 
              username: p['username']
            ));
          }
        }
      }
      if (mounted) setState(() => _typingUsers = typers);
    }).subscribe((status, error) async {
      if (status == RealtimeSubscribeStatus.subscribed) {
        await presenceChannel.track({
          'user_id': _supabase.auth.currentUser?.id,
          'is_typing': false,
          'full_name': 'User', 
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

  void _pickGiphy() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => GiphyPicker(
        onSelected: (url) {
          setState(() {
            _attachedFiles.add({
              'name': 'giphy.gif',
              'url': url,
              'size': 0,
              'type': 'image/gif',
            });
          });
        },
      ),
    );
  }

  void _pickGoogleDrive() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => GoogleDrivePicker(
        onFileSelected: (GoogleDriveFile file) {
          final driveService = GoogleDriveService();
          setState(() {
            _attachedFiles.add({
              'name': file.name,
              'url': driveService.getViewUrl(file),
              'size': file.size ?? 0,
              'type': file.mimeType ?? 'application/octet-stream',
              'source': 'google_drive',
              'drive_id': file.id,
              'thumbnail': file.thumbnailLink,
            });
          });
        },
      ),
    );
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
      backgroundColor: ShadColors.background,
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
                    child: CircularProgressIndicator(strokeWidth: 2, color: ShadColors.mutedForeground),
                  ),
                  const SizedBox(width: 8),
                    Text(
                      '${_typingUsers.map((u) => u.fullName ?? u.username).join(", ")} is typing...',
                      style: const TextStyle(fontSize: 12, color: ShadColors.mutedForeground, fontStyle: FontStyle.italic),
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
              onPickGiphy: _pickGiphy,
              onPickGoogleDrive: _pickGoogleDrive,
              showMentions: _showMentions,
              mentionQuery: _mentionQuery,
              workspaceMembers: _workspaceMembers,
              onMentionSelected: _onMentionSelected,
            ),
        ],
      ),
    );
  }

  Widget _buildDesktopHeader(String title) {
    return Container(
      height: 64,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      decoration: const BoxDecoration(
        color: ShadColors.background,
        border: Border(bottom: BorderSide(color: ShadColors.border)),
      ),
      child: Row(
        children: [
          Icon(widget.channel != null ? Icons.tag : Icons.person_outline, color: ShadColors.mutedForeground),
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
    
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
      margin: const EdgeInsets.symmetric(vertical: 2),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ShadAvatar(
            url: sender?.avatarUrl,
            name: sender?.fullName ?? sender?.username ?? '?',
            size: 36,
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
                    if (sender?.username != null)
                      Padding(
                        padding: const EdgeInsets.only(left: 4),
                        child: Text(
                          '@${sender!.username}',
                          style: const TextStyle(fontSize: 11, color: ShadColors.mutedForeground),
                        ),
                      ),
                    if (sender?.badge != null)
                      Padding(
                        padding: const EdgeInsets.only(left: 6),
                        child: ShadBadge(label: sender!.badge!, variant: sender!.badge),
                      ),
                    const SizedBox(width: 8),
                    Text(
                      DateFormat('h:mm a').format(message.createdAt),
                      style: const TextStyle(fontSize: 10, color: ShadColors.mutedForeground),
                    ),
                    const Spacer(),
                    _buildActions(context),
                  ],
                ),
                if (parent != null)
                  _buildParentMessage(parent),
                const SizedBox(height: 2),
                if (message.content.isNotEmpty)
                  Text(
                    message.content,
                    style: const TextStyle(fontSize: 15, height: 1.4, color: ShadColors.foreground),
                  ),
                if (files != null)
                  _buildFiles(files),
                if (message.reactions != null && message.reactions!.isNotEmpty)
                  const SizedBox(height: 4),
                if (message.reactions != null && message.reactions!.isNotEmpty)
                  _buildReactions(),
              ],
            ),
          ),
        ],
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
          final isGoogleDrive = file['source'] == 'google_drive';
          
          if (isImage && !isGoogleDrive) {
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
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: isGoogleDrive ? const Color(0xFF4285f4).withOpacity(0.05) : ShadColors.secondary,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: isGoogleDrive ? const Color(0xFF4285f4).withOpacity(0.2) : ShadColors.border),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: isGoogleDrive ? const Color(0xFF4285f4).withOpacity(0.1) : ShadColors.background,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Icon(
                    isGoogleDrive ? Icons.add_to_drive : Icons.insert_drive_file, 
                    size: 18, 
                    color: isGoogleDrive ? const Color(0xFF4285f4) : ShadColors.mutedForeground,
                  ),
                ),
                const SizedBox(width: 10),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      file['name'],
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                    ),
                    if (isGoogleDrive)
                      const Text(
                        'Google Drive',
                        style: TextStyle(fontSize: 10, color: Color(0xFF4285f4)),
                      ),
                  ],
                ),
                const SizedBox(width: 8),
                Icon(Icons.open_in_new, size: 14, color: isGoogleDrive ? const Color(0xFF4285f4) : ShadColors.mutedForeground),
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
              color: hasReacted ? ShadColors.primary.withOpacity(0.1) : ShadColors.secondary,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: hasReacted ? ShadColors.primary.withOpacity(0.2) : Colors.transparent),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(entry.key, style: const TextStyle(fontSize: 12)),
                const SizedBox(width: 4),
                Text('${entry.value.length}', style: TextStyle(fontSize: 10, color: hasReacted ? ShadColors.primary : ShadColors.mutedForeground, fontWeight: hasReacted ? FontWeight.bold : FontWeight.normal)),
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
        border: Border(left: BorderSide(color: ShadColors.border, width: 2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.reply, size: 12, color: ShadColors.mutedForeground),
              const SizedBox(width: 4),
              Text(
                parentSender?.fullName ?? parentSender?.username ?? 'User',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: ShadColors.mutedForeground),
              ),
            ],
          ),
          Text(
            parent['content'] ?? '',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 12, color: ShadColors.mutedForeground, fontStyle: FontStyle.italic),
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
          icon: const Icon(Icons.reply, size: 16, color: ShadColors.mutedForeground),
          onPressed: () => onReply(message),
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(),
          visualDensity: VisualDensity.compact,
          tooltip: 'Reply',
        ),
        const SizedBox(width: 8),
        IconButton(
          icon: const Icon(Icons.emoji_emotions_outlined, size: 16, color: ShadColors.mutedForeground),
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
        backgroundColor: ShadColors.background,
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
  final VoidCallback onPickGiphy;
  final VoidCallback onPickGoogleDrive;
  final bool showMentions;
  final String mentionQuery;
  final List<Profile> workspaceMembers;
  final Function(Profile) onMentionSelected;

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
    required this.onPickGiphy,
    required this.onPickGoogleDrive,
    required this.showMentions,
    required this.mentionQuery,
    required this.workspaceMembers,
    required this.onMentionSelected,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        color: ShadColors.background,
        border: Border(top: BorderSide(color: ShadColors.border)),
      ),
      child: SafeArea(
        child: Column(
          children: [
            if (showMentions)
              MentionsList(
                members: workspaceMembers,
                query: mentionQuery,
                onSelected: onMentionSelected,
              ),
            if (replyingTo != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                margin: const EdgeInsets.only(bottom: 8),
                decoration: BoxDecoration(
                  color: ShadColors.secondary,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.reply, size: 16, color: ShadColors.mutedForeground),
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
                            style: const TextStyle(fontSize: 11, color: ShadColors.mutedForeground),
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
                    final isGoogleDrive = file['source'] == 'google_drive';
                    return Container(
                      width: 150,
                      margin: const EdgeInsets.only(right: 8, bottom: 8),
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: isGoogleDrive ? const Color(0xFF4285f4).withOpacity(0.05) : ShadColors.background,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: isGoogleDrive ? const Color(0xFF4285f4).withOpacity(0.3) : ShadColors.border),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            isGoogleDrive ? Icons.add_to_drive : Icons.insert_drive_file, 
                            size: 16, 
                            color: isGoogleDrive ? const Color(0xFF4285f4) : ShadColors.mutedForeground,
                          ),
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
                border: Border.all(color: ShadColors.border),
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
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    ),
                    onChanged: (val) => onTyping(val.isNotEmpty),
                    onSubmitted: (_) => onSend(),
                  ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: const BoxDecoration(
                        color: ShadColors.secondary,
                        borderRadius: BorderRadius.only(
                          bottomLeft: Radius.circular(7),
                          bottomRight: Radius.circular(7),
                        ),
                      ),
                      child: Row(
                        children: [
                          IconButton(icon: const Icon(Icons.alternate_email, size: 20, color: ShadColors.mutedForeground), onPressed: () {}),
                          IconButton(icon: const Icon(Icons.sentiment_satisfied_alt, size: 20, color: ShadColors.mutedForeground), onPressed: () {}),
                            IconButton(
                              icon: isUploading 
                                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                                  : const Icon(Icons.attach_file, size: 20, color: ShadColors.mutedForeground), 
                              onPressed: isUploading ? null : onPickFiles,
                            ),
                            IconButton(
                              icon: const Icon(Icons.add_to_drive, size: 20, color: Color(0xFF4285f4)),
                              onPressed: onPickGoogleDrive,
                              tooltip: 'Google Drive',
                            ),
                            IconButton(
                              icon: const Icon(Icons.gif_box_outlined, size: 22, color: ShadColors.mutedForeground),
                              onPressed: onPickGiphy,
                            ),
                            const Spacer(),
                            ElevatedButton(
                              onPressed: isUploading ? null : onSend,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: ShadColors.primary,
                                foregroundColor: ShadColors.primaryForeground,
                                minimumSize: const Size(32, 32),
                                padding: const EdgeInsets.symmetric(horizontal: 12),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                                elevation: 0,
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
