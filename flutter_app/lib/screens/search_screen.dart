import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:ERPComm/models/message.dart';
import 'package:intl/intl.dart';

class SearchScreen extends StatefulWidget {
  final String workspaceId;
  const SearchScreen({super.key, required this.workspaceId});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _supabase = Supabase.instance.client;
  final _searchController = TextEditingController();
  List<Message> _results = [];
  bool _isSearching = false;

  Future<void> _handleSearch(String query) async {
    if (query.trim().isEmpty) return;
    setState(() => _isSearching = true);
    
    try {
      final response = await _supabase
          .from('messages')
          .select('*, sender:profiles!sender_id(*)')
          .eq('workspace_id', widget.workspaceId)
          .textSearch('content', query)
          .order('created_at', ascending: false);

      final List<dynamic> data = response as List<dynamic>;
      setState(() {
        _results = data.map((item) => Message.fromJson(item)).toList();
        _isSearching = false;
      });
    } catch (e) {
      debugPrint('Search error: $e');
      setState(() => _isSearching = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: TextField(
          controller: _searchController,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'Search messages...',
            border: InputBorder.none,
          ),
          onSubmitted: _handleSearch,
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () => _handleSearch(_searchController.text),
          ),
        ],
      ),
      body: _isSearching
          ? const Center(child: CircularProgressIndicator())
          : _results.isEmpty
              ? const Center(child: Text('No results found'))
              : ListView.builder(
                  itemCount: _results.length,
                  itemBuilder: (context, index) {
                    final message = _results[index];
                    return ListTile(
                      leading: CircleAvatar(
                        backgroundImage: message.sender?.avatarUrl != null ? NetworkImage(message.sender!.avatarUrl!) : null,
                        child: message.sender?.avatarUrl == null ? Text(message.sender?.username?[0] ?? '?') : null,
                      ),
                      title: Text(message.sender?.fullName ?? message.sender?.username ?? 'User'),
                      subtitle: Text(message.content),
                      trailing: Text(DateFormat('MMM d').format(message.createdAt)),
                    );
                  },
                ),
    );
  }
}
